package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	bankports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/store"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var (
	t0   = time.Date(2026, 10, 27, 15, 0, 0, 0, time.UTC)
	body = "# Autorización para compartir tus datos con Fynk\n"
	sum  = sha256.Sum256([]byte(body))
	text = domain.Text{Version: "2026-10-v1", BodyMD: body, SHA256: sum[:], PublishedAt: t0}
)

const device = "0192f0a0-0000-7000-8000-000000000001"

type recorder struct {
	mu     sync.Mutex
	events []audit.Event
	err    error
}

func (r *recorder) Record(_ context.Context, e audit.Event) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
	return r.err
}

func (r *recorder) types() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []string
	for _, e := range r.events {
		out = append(out, e.Type)
	}
	return out
}

// bank is M5's revoker as M4 sees it: it records each notice and fails while down is set.
type bank struct {
	mu    sync.Mutex
	calls []string
	down  bool
}

func (b *bank) RevokeConsent(_ context.Context, provider, providerConsentID string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.calls = append(b.calls, provider+"/"+providerConsentID)
	if b.down {
		return fmt.Errorf("bankdemo: revoke: %w", bankports.ErrProviderUnavailable)
	}
	return nil
}

func (b *bank) count() int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.calls)
}

func (b *bank) setDown(down bool) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.down = down
}

func setup(t *testing.T) (*Service, *store.Memory, *recorder, *clock.Fixed) {
	s, st, rec, clk, _ := setupWithBank(t)
	return s, st, rec, clk
}

func setupWithBank(t *testing.T) (*Service, *store.Memory, *recorder, *clock.Fixed, *bank) {
	t.Helper()
	st := store.NewMemory(text)
	rec := &recorder{}
	clk := clock.NewFixed(t0)
	b := &bank{}
	return New(st, clk, rec, slog.New(slog.NewTextHandler(io.Discard, nil)), b), st, rec, clk, b
}

func request(user string) domain.Request {
	return domain.Request{
		UserID: user, DeviceID: device, Provider: "banco-demo",
		Scopes:      []domain.Scope{domain.ScopeBalances, domain.ScopeTransactions, domain.ScopeAccountDetails},
		Purpose:     domain.Purpose,
		TermDays:    domain.TermDays,
		TextVersion: text.Version, TextSHA256: hex.EncodeToString(sum[:]),
		AppVersion: "0.1.0", Locale: domain.Locale,
	}
}

func create(t *testing.T, s *Service, user string) domain.Consent {
	t.Helper()
	c, err := s.Create(context.Background(), request(user), "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	return c
}

func TestCurrentTextIsTheSeededVersion(t *testing.T) {
	s, _, _, _ := setup(t)
	got, err := s.CurrentText(context.Background())
	if err != nil || got.Version != "2026-10-v1" {
		t.Fatalf("CurrentText = %+v, %v", got, err)
	}
}

// HU-006: the acceptance is stored explicitly as a pending consent with its evidence.
func TestCreateStoresAPendingConsentWithEvidence(t *testing.T) {
	s, st, _, _ := setup(t)
	c := create(t, s, "u1")
	stored, _ := st.Get(context.Background(), c.ID)
	if stored.Status != domain.StatusPending || stored.Evidence.AcceptedAt.IsZero() || stored.UserID != "u1" {
		t.Fatalf("stored %+v", stored)
	}
	if !strings.HasPrefix(c.ID[14:], "7") || len(c.ID) != 36 {
		t.Fatalf("id %q is not a UUID v7", c.ID)
	}
}

func TestCreateWithAnUnknownTextVersionFails(t *testing.T) {
	s, _, _, _ := setup(t)
	r := request("u1")
	r.TextVersion = "2025-01-v0"
	if _, err := s.Create(context.Background(), r, ""); !errors.Is(err, domain.ErrUnknownTextVersion) {
		t.Fatalf("err = %v", err)
	}
}

func TestTheSameIdempotencyKeyReturnsTheFirstConsent(t *testing.T) {
	s, st, rec, _ := setup(t)
	first, err := s.Create(context.Background(), request("u1"), "key-1")
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.Create(context.Background(), request("u1"), "key-1")
	if err != nil || again.ID != first.ID || st.Len() != 1 || len(rec.types()) != 1 {
		t.Fatalf("again = %v, %v (%d rows, %d events)", again.ID, err, st.Len(), len(rec.types()))
	}
	other := request("u1")
	other.Provider = "billetera-demo"
	if _, err := s.Create(context.Background(), other, "key-1"); !errors.Is(err, domain.ErrIdempotencyConflict) {
		t.Fatalf("other request, same key: err = %v", err)
	}
	if _, err := s.Create(context.Background(), request("u2"), "key-1"); err != nil {
		t.Fatalf("another user may use the same key: %v", err)
	}
}

// HU-007: the user sees only their own consents, newest first, with the status as of now.
func TestListShowsOnlyTheUsersConsentsWithTheCurrentStatus(t *testing.T) {
	s, _, _, clk := setup(t)
	older := create(t, s, "u1")
	clk.Advance(time.Minute)
	newer := create(t, s, "u1")
	create(t, s, "u2")
	if err := s.MarkGranted(context.Background(), older.ID, "bd-1"); err != nil {
		t.Fatal(err)
	}
	clk.Advance(366 * 24 * time.Hour) // past the term, before the daily job runs

	list, err := s.List(context.Background(), "u1")
	if err != nil || len(list) != 2 {
		t.Fatalf("List = %d, %v", len(list), err)
	}
	if list[0].ID != newer.ID || list[1].ID != older.ID {
		t.Fatal("not newest first")
	}
	if list[1].Status != domain.StatusExpired || list[1].GrantedAt == nil || list[1].ExpiresAt == nil {
		t.Fatalf("older %+v", list[1])
	}
}

func TestGetHidesOtherUsersConsents(t *testing.T) {
	s, _, _, _ := setup(t)
	c := create(t, s, "u1")
	if _, err := s.Get(context.Background(), "u2", c.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
	if got, err := s.Get(context.Background(), "u1", c.ID); err != nil || got.ID != c.ID {
		t.Fatalf("Get = %+v, %v", got, err)
	}
}

func TestMarkGrantedActivatesForTwelveMonths(t *testing.T) {
	s, _, _, clk := setup(t)
	c := create(t, s, "u1")
	if ok, _ := s.Active(context.Background(), "u1", c.ID); ok {
		t.Fatal("a pending consent is not active")
	}
	clk.Advance(time.Minute)
	if err := s.MarkGranted(context.Background(), c.ID, "bd-1"); err != nil {
		t.Fatal(err)
	}
	got, _ := s.Get(context.Background(), "u1", c.ID)
	if got.Status != domain.StatusActive || !got.ExpiresAt.Equal(t0.Add(time.Minute).AddDate(0, 0, 365)) {
		t.Fatalf("granted %+v", got)
	}
	if ok, err := s.Active(context.Background(), "u1", c.ID); !ok || err != nil {
		t.Fatalf("Active = %v, %v", ok, err)
	}
	if err := s.MarkGranted(context.Background(), c.ID, "bd-1"); !errors.Is(err, domain.ErrNotPending) {
		t.Fatalf("second grant: err = %v", err)
	}
}

// Module test: a consent cannot become active without evidence and a known text version.
func TestMarkGrantedRefusesAConsentWithoutEvidenceOrKnownText(t *testing.T) {
	s, st, _, _ := setup(t)
	noEvidence := create(t, s, "u1")
	st.Edit(noEvidence.ID, func(c *domain.Consent) { c.Evidence = domain.Evidence{} })
	if err := s.MarkGranted(context.Background(), noEvidence.ID, "bd-1"); !errors.Is(err, domain.ErrMissingEvidence) {
		t.Errorf("without evidence: err = %v", err)
	}
	unknownText := create(t, s, "u1")
	st.Edit(unknownText.ID, func(c *domain.Consent) { c.TextVersion = "2099-01-v9" })
	if err := s.MarkGranted(context.Background(), unknownText.ID, "bd-1"); !errors.Is(err, domain.ErrUnknownTextVersion) {
		t.Errorf("unknown text: err = %v", err)
	}
	for _, id := range []string{noEvidence.ID, unknownText.ID} {
		if ok, _ := s.Active(context.Background(), "u1", id); ok {
			t.Errorf("%s became active", id)
		}
	}
}

func TestActiveIsFalseForAnotherUserOrAnUnknownConsent(t *testing.T) {
	s, _, _, _ := setup(t)
	c := create(t, s, "u1")
	_ = s.MarkGranted(context.Background(), c.ID, "bd-1")
	if ok, err := s.Active(context.Background(), "u2", c.ID); ok || err != nil {
		t.Fatalf("other user: %v, %v", ok, err)
	}
	if ok, err := s.Active(context.Background(), "u1", "0192f0a0-0000-7000-8000-00000000dead"); ok || err != nil {
		t.Fatalf("unknown: %v, %v", ok, err)
	}
}

// Module test: expiry after term_days with an injected clock, recorded once.
func TestExpireDueMarksExpiredConsentsOnce(t *testing.T) {
	s, st, rec, clk := setup(t)
	c := create(t, s, "u1")
	_ = s.MarkGranted(context.Background(), c.ID, "bd-1")
	clk.Advance(365*24*time.Hour - time.Second)
	if n, _ := s.ExpireDue(context.Background()); n != 0 {
		t.Fatalf("expired %d before the term", n)
	}
	if ok, _ := s.Active(context.Background(), "u1", c.ID); !ok {
		t.Fatal("still active one second before the term")
	}
	clk.Advance(time.Second)
	if ok, _ := s.Active(context.Background(), "u1", c.ID); ok {
		t.Fatal("Active must be false when the term ends, even before the job runs")
	}
	if n, err := s.ExpireDue(context.Background()); n != 1 || err != nil {
		t.Fatalf("ExpireDue = %d, %v", n, err)
	}
	if n, _ := s.ExpireDue(context.Background()); n != 0 {
		t.Fatal("a second run expires nothing")
	}
	stored, _ := st.Get(context.Background(), c.ID)
	if stored.Status != domain.StatusExpired {
		t.Fatalf("stored status %s", stored.Status)
	}
	want := []string{audit.ConsentCreated, audit.ConsentGranted, audit.ConsentExpired}
	if got := rec.types(); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("audit %v, want %v", got, want)
	}
}

func TestRunExpiryRunsAtOnceAndStopsWithTheContext(t *testing.T) {
	s, st, _, clk := setup(t)
	c := create(t, s, "u1")
	_ = s.MarkGranted(context.Background(), c.ID, "bd-1")
	clk.Advance(400 * 24 * time.Hour)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.RunExpiry(ctx, time.Hour); close(done) }()
	deadline := time.Now().Add(2 * time.Second)
	for {
		if got, _ := st.Get(context.Background(), c.ID); got.Status == domain.StatusExpired {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the first run did not expire the consent")
		}
		time.Sleep(5 * time.Millisecond)
	}
	cancel()
	<-done
}

// Module test: one audit row per state change, none with amounts, emails or tokens.
func TestEveryStateChangeIsAuditedWithProviderAndConsentIDOnly(t *testing.T) {
	s, _, rec, _ := setup(t)
	c := create(t, s, "u1")
	_ = s.MarkGranted(context.Background(), c.ID, "bd-1")
	if len(rec.events) != 2 {
		t.Fatalf("%d events", len(rec.events))
	}
	for _, e := range rec.events {
		if e.UserID != "u1" || e.DeviceID != device || !e.At.Equal(t0) {
			t.Errorf("%s: %+v", e.Type, e)
		}
		if len(e.Meta) != 2 || e.Meta["provider"] != "banco-demo" || e.Meta["consent_id"] != c.ID {
			t.Errorf("%s: meta %v", e.Type, e.Meta)
		}
	}
}

func TestAnAuditFailureDoesNotUndoTheChange(t *testing.T) {
	s, _, rec, _ := setup(t)
	rec.err = errors.New("audit store down")
	c := create(t, s, "u1")
	if err := s.MarkGranted(context.Background(), c.ID, "bd-1"); err != nil {
		t.Fatalf("MarkGranted: %v", err)
	}
	if ok, _ := s.Active(context.Background(), "u1", c.ID); !ok {
		t.Fatal("the grant must stand")
	}
}

// The scopes come from M5's provider list: an entity Fynk cannot reach cannot be consented.
func TestScopesComeFromTheBankProviderList(t *testing.T) {
	s, _, _, _ := setup(t)
	r := request("u1")
	r.Provider = "bancolombia"
	if _, err := s.Create(context.Background(), r, ""); !errors.Is(err, domain.ErrUnsupportedProvider) {
		t.Fatalf("bancolombia before its adapter: err = %v", err)
	}
	r.Provider = "billetera-demo"
	if _, err := s.Create(context.Background(), r, ""); err != nil {
		t.Fatalf("billetera-demo: %v", err)
	}
}

func grantedConsent(t *testing.T, s *Service, user string) domain.Consent {
	t.Helper()
	c := create(t, s, user)
	if err := s.MarkGranted(context.Background(), c.ID, "bd-"+c.ID[30:]); err != nil {
		t.Fatal(err)
	}
	return c
}

// HU-008: immediate revocation, the entity is notified, no new syncs, auditable evidence.
func TestRevokeIsImmediateAndNotifiesTheEntity(t *testing.T) {
	s, _, rec, clk, b := setupWithBank(t)
	c := grantedConsent(t, s, "u1")
	clk.Advance(time.Hour)
	got, err := s.Revoke(context.Background(), "u1", c.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != domain.StatusRevoked || !got.RevokedAt.Equal(t0.Add(time.Hour)) || got.ProviderNotifiedAt == nil {
		t.Fatalf("revoked %+v", got)
	}
	if ok, err := s.Active(context.Background(), "u1", c.ID); ok || err != nil {
		t.Fatalf("Active after revoke = %v, %v", ok, err)
	}
	if b.count() != 1 || b.calls[0] != "banco-demo/bd-"+c.ID[30:] {
		t.Fatalf("bank calls %v", b.calls)
	}
	want := []string{audit.ConsentCreated, audit.ConsentGranted, audit.ConsentRevoked}
	if strings.Join(rec.types(), ",") != strings.Join(want, ",") {
		t.Fatalf("audit %v", rec.types())
	}
	revoked := rec.events[2]
	if len(revoked.Meta) != 2 || revoked.Meta["provider"] != "banco-demo" || revoked.Meta["consent_id"] != c.ID || revoked.UserID != "u1" {
		t.Fatalf("revoked event %+v", revoked)
	}
}

// HU-008: if the entity cannot be reached, the consent stays revoked and Fynk keeps trying.
func TestAnUnreachableEntityIsRetriedUntilItAnswers(t *testing.T) {
	s, st, rec, clk, b := setupWithBank(t)
	c := grantedConsent(t, s, "u1")
	b.setDown(true)
	got, err := s.Revoke(context.Background(), "u1", c.ID)
	if err != nil || got.Status != domain.StatusRevoked || got.ProviderNotifiedAt != nil {
		t.Fatalf("revoke while the bank is down: %+v, %v", got, err)
	}
	if ok, _ := s.Active(context.Background(), "u1", c.ID); ok {
		t.Fatal("the revocation must not wait for the bank")
	}
	clk.Advance(9 * time.Minute)
	if _, _ = s.NotifyDue(context.Background()); b.count() != 1 {
		t.Fatalf("retried before 10 minutes: %d calls", b.count())
	}
	clk.Advance(time.Minute)
	if n, _ := s.NotifyDue(context.Background()); n != 0 || b.count() != 2 {
		t.Fatalf("10 minutes: confirmed %d, calls %d", n, b.count())
	}
	b.setDown(false)
	clk.Advance(10 * time.Minute)
	if n, _ := s.NotifyDue(context.Background()); n != 1 || b.count() != 3 {
		t.Fatalf("20 minutes: confirmed %d, calls %d", n, b.count())
	}
	stored, _ := st.Get(context.Background(), c.ID)
	if stored.ProviderNotifiedAt == nil || stored.NextNotifyAt != nil || stored.NotifyAttempts != 3 {
		t.Fatalf("stored %+v", stored)
	}
	clk.Advance(time.Hour)
	if _, _ = s.NotifyDue(context.Background()); b.count() != 3 {
		t.Fatal("a confirmed notice was sent again")
	}
	if n := strings.Count(strings.Join(rec.types(), ","), audit.ConsentRevoked); n != 1 {
		t.Fatalf("consent.revoked audited %d times", n)
	}
}

func TestNoticesStopAfterTwentyFourHours(t *testing.T) {
	s, _, _, clk, b := setupWithBank(t)
	c := grantedConsent(t, s, "u1")
	b.setDown(true)
	_, _ = s.Revoke(context.Background(), "u1", c.ID)
	for i := 0; i < 6*26; i++ { // 26 hours, every 10 minutes
		clk.Advance(10 * time.Minute)
		_, _ = s.NotifyDue(context.Background())
	}
	// One try at once, then one every 10 minutes while less than 24 hours have passed.
	if b.count() < 140 || b.count() > 145 {
		t.Fatalf("%d notices in 26 hours", b.count())
	}
	before := b.count()
	clk.Advance(time.Hour)
	_, _ = s.NotifyDue(context.Background())
	if b.count() != before {
		t.Fatal("still notifying after 24 hours")
	}
}

func TestRevokingTwiceNotifiesOnce(t *testing.T) {
	s, _, rec, _, b := setupWithBank(t)
	c := grantedConsent(t, s, "u1")
	first, _ := s.Revoke(context.Background(), "u1", c.ID)
	again, err := s.Revoke(context.Background(), "u1", c.ID)
	if err != nil || again.ID != first.ID || again.Status != domain.StatusRevoked || b.count() != 1 {
		t.Fatalf("again %+v, %v, %d calls", again, err, b.count())
	}
	if len(rec.types()) != 3 {
		t.Fatalf("audit %v", rec.types())
	}
}

func TestAPendingConsentIsRevokedWithoutCallingTheEntity(t *testing.T) {
	s, _, _, _, b := setupWithBank(t)
	c := create(t, s, "u1")
	got, err := s.Revoke(context.Background(), "u1", c.ID)
	if err != nil || got.Status != domain.StatusRevoked || b.count() != 0 {
		t.Fatalf("%+v, %v, %d calls", got, err, b.count())
	}
	if err := s.MarkGranted(context.Background(), c.ID, "bd-late"); !errors.Is(err, domain.ErrNotPending) {
		t.Fatalf("a revoked consent was granted afterwards: %v", err)
	}
}

func TestOnlyTheOwnerCanRevokeAndOnlyWhileItLasts(t *testing.T) {
	s, _, _, clk, _ := setupWithBank(t)
	c := grantedConsent(t, s, "u1")
	if _, err := s.Revoke(context.Background(), "u2", c.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("other user: err = %v", err)
	}
	if ok, _ := s.Active(context.Background(), "u1", c.ID); !ok {
		t.Fatal("another user's attempt changed the consent")
	}
	clk.Advance(366 * 24 * time.Hour)
	if _, err := s.Revoke(context.Background(), "u1", c.ID); !errors.Is(err, domain.ErrNotRevocable) {
		t.Fatalf("expired: err = %v", err)
	}
}
