package service

import (
	"bytes"
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/keys"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/store"
	consentports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var now = time.Date(2026, 10, 29, 15, 0, 0, 0, time.UTC)

const (
	userA   = "user-a"
	userB   = "user-b"
	deviceA = "0b4f5d1e-9a3c-4c2e-8f1a-2d3e4f5a6b7c"
	deviceB = "1c5e6f2a-0b4d-4d3f-9a2b-3e4f5a6b7c8d"
)

// fakeProvider is a bank that answers what the test sets and records what it was sent.
type fakeProvider struct {
	mu        sync.Mutex
	id        string
	par       []ports.PARRequest
	exchanges []ports.CodeExchange
	refreshes []string
	tokens    ports.TokenSet
	err       error
}

func (f *fakeProvider) ID() string { return f.id }
func (f *fakeProvider) PushAuthorization(_ context.Context, r ports.PARRequest) (ports.PARResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.par = append(f.par, r)
	if f.err != nil {
		return ports.PARResult{}, f.err
	}
	return ports.PARResult{AuthorizeURL: "https://bank.example/authorize?request_uri=urn:x", ExpiresIn: 90 * time.Second}, nil
}
func (f *fakeProvider) ExchangeCode(_ context.Context, r ports.CodeExchange) (ports.TokenSet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.exchanges = append(f.exchanges, r)
	return f.tokens, f.err
}
func (f *fakeProvider) Refresh(_ context.Context, t string) (ports.TokenSet, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.refreshes = append(f.refreshes, t)
	return f.tokens, f.err
}
func (f *fakeProvider) Accounts(context.Context, string) ([]ports.Account, error) { return nil, f.err }
func (f *fakeProvider) Transactions(context.Context, string, string, time.Time, string) (ports.TxPage, error) {
	return ports.TxPage{}, f.err
}
func (f *fakeProvider) RevokeConsent(context.Context, string) error       { return f.err }
func (f *fakeProvider) Products(context.Context) ([]ports.Product, error) { return nil, nil }

// fakeConsents is M4: pending consents by id, and what was granted.
type fakeConsents struct {
	mu      sync.Mutex
	pending map[string]consentports.Pending // by consent id, all owned by userA
	granted map[string]string               // consent id -> provider consent id
	active  map[string]bool
}

func (f *fakeConsents) Pending(_ context.Context, userID, id string) (consentports.Pending, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	p, ok := f.pending[id]
	if !ok || userID != userA {
		return consentports.Pending{}, consentports.ErrConsentNotFound
	}
	if _, done := f.granted[id]; done {
		return consentports.Pending{}, consentports.ErrConsentNotPending
	}
	return p, nil
}
func (f *fakeConsents) MarkGranted(_ context.Context, id, providerConsentID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.granted[id] = providerConsentID
	f.active[id] = true
	return nil
}
func (f *fakeConsents) Active(_ context.Context, userID, id string) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	return userID == userA && f.active[id], nil
}

type recorder struct {
	mu     sync.Mutex
	events []audit.Event
}

func (r *recorder) Record(_ context.Context, e audit.Event) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
	return nil
}

type fixture struct {
	svc      *Service
	bank     *fakeProvider
	consents *fakeConsents
	links    *store.Memory
	audit    *recorder
	clock    *clock.Fixed
	fp       keys.Fingerprinter
}

func setup(t *testing.T) *fixture {
	t.Helper()
	c := clock.NewFixed(now)
	fp, err := keys.NewLocalHMAC([]byte("0123456789abcdef0123456789abcdef"))
	if err != nil {
		t.Fatal(err)
	}
	f := &fixture{
		bank: &fakeProvider{id: "banco-demo", tokens: ports.TokenSet{
			AccessToken: "access-1", RefreshToken: "refresh-1", ExpiresIn: 5 * time.Minute, ProviderConsentID: "bank-consent-1",
		}},
		consents: &fakeConsents{
			pending: map[string]consentports.Pending{"c-1": {
				ID: "c-1", Provider: "banco-demo", Scopes: []string{"balances", "transactions", "account_details"},
				Purpose: "Mostrarte tus finanzas y recomendaciones dentro de Fynk.", TermDays: 365,
			}},
			granted: map[string]string{}, active: map[string]bool{},
		},
		links: store.NewMemory(), audit: &recorder{}, clock: c, fp: fp,
	}
	f.svc = New(Deps{
		Providers: ProviderMap{"banco-demo": f.bank}, Pending: f.consents, Consents: f.consents,
		Links: f.links, Authorizations: store.NewMemoryAuthorizations(c), Fingerprints: fp,
		Audit: f.audit, Clock: c, Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
		RedirectURI: "fynk://bank/callback",
	})
	return f
}

var start = StartRequest{
	Provider: "banco-demo", ConsentID: "c-1",
	CodeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", State: "state-1234",
}

func (f *fixture) link(t *testing.T) Linked {
	t.Helper()
	s, err := f.svc.CreateAuthorization(context.Background(), User{userA, deviceA}, start)
	if err != nil {
		t.Fatal(err)
	}
	l, err := f.svc.Exchange(context.Background(), User{userA, deviceA}, s.AuthorizationID, "code-1", "verifier-1")
	if err != nil {
		t.Fatal(err)
	}
	return l
}

func TestThePARCarriesExactlyWhatTheUserAccepted(t *testing.T) {
	f := setup(t)
	s, err := f.svc.CreateAuthorization(context.Background(), User{userA, deviceA}, start)
	if err != nil {
		t.Fatal(err)
	}
	if s.AuthorizeURL != "https://bank.example/authorize?request_uri=urn:x" || s.AuthorizationID == "" {
		t.Fatalf("got %+v", s)
	}
	// The bank's request_uri lives 90 s, shorter than 10 minutes: the authorization follows it.
	if !s.ExpiresAt.Equal(now.Add(90 * time.Second)) {
		t.Fatalf("ExpiresAt = %v", s.ExpiresAt)
	}
	par := f.bank.par[0]
	if par.ConsentID != "c-1" || par.Purpose != "Mostrarte tus finanzas y recomendaciones dentro de Fynk." ||
		par.TermDays != 365 || len(par.Scopes) != 3 || par.RedirectURI != "fynk://bank/callback" ||
		par.CodeChallenge != start.CodeChallenge || par.State != "state-1234" || par.Nonce == "" {
		t.Fatalf("PAR = %+v", par)
	}
}

func TestAuthorizationNeedsADeviceAndThePendingConsentOfThatUserAndEntity(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	cases := map[string]struct {
		u    User
		r    StartRequest
		want error
	}{
		"no trusted device":          {User{userA, ""}, start, ErrDeviceRequired},
		"another user's consent":     {User{userB, deviceB}, start, consentports.ErrConsentNotFound},
		"an unknown consent":         {User{userA, deviceA}, StartRequest{Provider: "banco-demo", ConsentID: "nope"}, consentports.ErrConsentNotFound},
		"another entity":             {User{userA, deviceA}, StartRequest{Provider: "billetera-demo", ConsentID: "c-1"}, ErrProviderMismatch},
		"an entity Fynk can't reach": {User{userA, deviceA}, StartRequest{Provider: "bancolombia", ConsentID: "c-2"}, ports.ErrProviderUnavailable},
	}
	f.consents.pending["c-2"] = consentports.Pending{ID: "c-2", Provider: "bancolombia"}
	for name, c := range cases {
		if _, err := f.svc.CreateAuthorization(ctx, c.u, c.r); !errors.Is(err, c.want) {
			t.Errorf("%s: got %v, want %v", name, err, c.want)
		}
	}
	if len(f.bank.par) != 0 {
		t.Fatal("no PAR may reach the bank when the checks fail")
	}
}

func TestAnAlreadyGrantedConsentCannotStartAnotherLink(t *testing.T) {
	f := setup(t)
	f.link(t)
	_, err := f.svc.CreateAuthorization(context.Background(), User{userA, deviceA}, start)
	if !errors.Is(err, consentports.ErrConsentNotPending) {
		t.Fatalf("got %v, want ErrConsentNotPending", err)
	}
}

func TestExchangeGrantsTheConsentStoresTheLinkWithAFingerprintAndReturnsTheTokens(t *testing.T) {
	f := setup(t)
	l := f.link(t)
	if l.AccessToken != "access-1" || l.RefreshToken != "refresh-1" || l.Provider != "banco-demo" ||
		l.ExpiresIn != 5*time.Minute || l.LinkID == "" {
		t.Fatalf("got %+v", l)
	}
	ex := f.bank.exchanges[0]
	if ex.Code != "code-1" || ex.CodeVerifier != "verifier-1" || ex.RedirectURI != "fynk://bank/callback" {
		t.Fatalf("exchange = %+v", ex)
	}
	if f.consents.granted["c-1"] != "bank-consent-1" {
		t.Fatalf("consent not granted with the bank's id: %v", f.consents.granted)
	}
	stored, err := f.links.Get(context.Background(), l.LinkID)
	if err != nil {
		t.Fatal(err)
	}
	want, _ := f.fp.Fingerprint(context.Background(), "refresh-1")
	if stored.UserID != userA || stored.DeviceID != deviceA || stored.ConsentID != "c-1" ||
		!bytes.Equal(stored.TokenFingerprint, want) {
		t.Fatalf("link = %+v", stored)
	}
	if bytes.Contains(stored.TokenFingerprint, []byte("refresh-1")) {
		t.Fatal("the link must never hold the token")
	}
}

func TestTheLinkIsAuditedWithAllowedKeysOnly(t *testing.T) {
	f := setup(t)
	l := f.link(t)
	if len(f.audit.events) != 1 {
		t.Fatalf("events = %+v", f.audit.events)
	}
	e := f.audit.events[0]
	if e.Type != audit.BankLinkCreated || e.UserID != userA || e.DeviceID != deviceA {
		t.Fatalf("event = %+v", e)
	}
	for k, v := range e.Meta {
		if k != "provider" && k != "link_id" && k != "status" {
			t.Fatalf("meta key %q is not allowed by M13", k)
		}
		if strings.Contains(v, "access") || strings.Contains(v, "refresh") {
			t.Fatalf("meta %q holds a token", k)
		}
	}
	if e.Meta["link_id"] != l.LinkID {
		t.Fatal("the event names the link")
	}
}

func TestAnAuthorizationWorksOnceOnlyForItsUserAndDeviceAndExpires(t *testing.T) {
	ctx := context.Background()

	f := setup(t)
	s, _ := f.svc.CreateAuthorization(ctx, User{userA, deviceA}, start)
	if _, err := f.svc.Exchange(ctx, User{userB, deviceB}, s.AuthorizationID, "code", "v"); !errors.Is(err, ErrAuthorizationNotFound) {
		t.Fatalf("another user: got %v", err)
	}

	f = setup(t)
	s, _ = f.svc.CreateAuthorization(ctx, User{userA, deviceA}, start)
	if _, err := f.svc.Exchange(ctx, User{userA, deviceB}, s.AuthorizationID, "code", "v"); !errors.Is(err, ErrAuthorizationNotFound) {
		t.Fatalf("another device: got %v", err)
	}

	f = setup(t)
	s, _ = f.svc.CreateAuthorization(ctx, User{userA, deviceA}, start)
	if _, err := f.svc.Exchange(ctx, User{userA, deviceA}, s.AuthorizationID, "code", "v"); err != nil {
		t.Fatal(err)
	}
	if _, err := f.svc.Exchange(ctx, User{userA, deviceA}, s.AuthorizationID, "code", "v"); !errors.Is(err, ErrAuthorizationNotFound) {
		t.Fatalf("second use: got %v", err)
	}

	f = setup(t)
	s, _ = f.svc.CreateAuthorization(ctx, User{userA, deviceA}, start)
	f.clock.Advance(91 * time.Second)
	if _, err := f.svc.Exchange(ctx, User{userA, deviceA}, s.AuthorizationID, "code", "v"); !errors.Is(err, ErrAuthorizationNotFound) {
		t.Fatalf("expired: got %v", err)
	}
	if len(f.bank.exchanges) != 0 {
		t.Fatal("an expired authorization must not reach the bank")
	}
}

func TestARejectedCodeGrantsNothingAndStoresNoLink(t *testing.T) {
	f := setup(t)
	ctx := context.Background()
	s, _ := f.svc.CreateAuthorization(ctx, User{userA, deviceA}, start)
	f.bank.err = ports.ErrInvalidGrant
	if _, err := f.svc.Exchange(ctx, User{userA, deviceA}, s.AuthorizationID, "bad", "v"); !errors.Is(err, ports.ErrInvalidGrant) {
		t.Fatalf("got %v, want ErrInvalidGrant", err)
	}
	if len(f.consents.granted) != 0 || len(f.audit.events) != 0 {
		t.Fatal("nothing may be granted or audited after a rejected code")
	}
}

func TestNewIDIsAUUIDv7(t *testing.T) {
	id := NewID(now)
	if len(id) != 36 || id[14] != '7' || !strings.ContainsAny(id[19:20], "89ab") {
		t.Fatalf("NewID = %s", id)
	}
	if NewID(now) == id {
		t.Fatal("two ids must differ")
	}
}
