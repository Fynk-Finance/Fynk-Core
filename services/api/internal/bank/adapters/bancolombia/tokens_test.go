package bancolombia

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var now = time.Date(2026, 11, 5, 15, 0, 0, 0, time.UTC)

// signer stands in for the KMS or file signer.
type signer struct{ audiences []string }

func (s *signer) ClientAssertion(_ context.Context, aud string) (string, error) {
	s.audiences = append(s.audiences, aud)
	return "signed.assertion.jwt", nil
}

// call is one request the fake Bancolombia received.
type call struct {
	method, path string
	header       http.Header
	form         url.Values
	body         map[string]any
}

// fakeBank answers like the API Market sandbox, with the bodies of its documented examples.
type fakeBank struct {
	mu      sync.Mutex
	calls   []call
	answers map[string]func(w http.ResponseWriter) // by "METHOD path"
}

func (f *fakeBank) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	c := call{method: r.Method, path: r.URL.Path, header: r.Header.Clone()}
	raw, _ := io.ReadAll(r.Body)
	if strings.HasPrefix(r.Header.Get("Content-Type"), "application/x-www-form-urlencoded") {
		c.form, _ = url.ParseQuery(string(raw))
	} else if len(raw) > 0 {
		_ = json.Unmarshal(raw, &c.body)
	}
	f.mu.Lock()
	f.calls = append(f.calls, c)
	answer := f.answers[r.Method+" "+r.URL.Path]
	f.mu.Unlock()
	if answer == nil {
		http.Error(w, `{"Code":"DS28"}`, http.StatusInternalServerError)
		return
	}
	answer(w)
}

func jsonAnswer(status int, body string) func(http.ResponseWriter) {
	return func(w http.ResponseWriter) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}
}

const (
	tokenOK   = `{"access_token":"zlJojElfSalTBc1CKVwi3adSHPpr","refresh_token":"EhRx3DsdmpU4J8ISVBeVYj5v5l2I2oDorfEVgbPcft","scope":"Account","token_type":"Bearer","expires_in":599}`
	consentOK = `{"Data":{"ConsentId":"ndgn1c0n63ntok","Permissions":["ReadAccountsBasic","ReadBalances","ReadTransactionsDetail"],"CreationDateTime":"2026-11-05T15:00:00Z","ExpirationDateTime":"2027-11-05T15:00:00Z","Status":"AwaitingAuthorization"}}`
	parOK     = `{"request_uri":"urn:ietf:params:oauth:request_uri:6esc_11ACC5bwc014ltc14eY22c","expires_in":90}`
)

func setup(t *testing.T) (*Adapter, *fakeBank, *signer) {
	t.Helper()
	bank := &fakeBank{answers: map[string]func(http.ResponseWriter){
		"POST /auth/token": jsonAnswer(200, tokenOK),
		"POST /auth/par":   jsonAnswer(200, parOK),
		"POST /api/open-banking/v1/deposits/accounts/account-access-consent": jsonAnswer(200, consentOK),
	}}
	srv := httptest.NewServer(bank)
	t.Cleanup(srv.Close)
	s := &signer{}
	a, err := New(Config{
		AuthBaseURL: srv.URL + "/auth", ResourceBaseURL: srv.URL + "/api",
		ClientID: "fynk-client", ClientSecret: "market-secret",
		Audience: "https://auth1.bancolombia.example", AuthorizeURL: "https://auth1.bancolombia.example/authorize",
		Owner:   Owner{IDType: "CC", ID: "78965432", Name: "Pepito Perez"},
		Sandbox: true, Signer: s, HTTP: srv.Client(), Clock: clock.NewFixed(now),
	})
	if err != nil {
		t.Fatal(err)
	}
	return a, bank, s
}

// Rule 10: outside the sandbox Fynk has no document to send, so the adapter is not built.
func TestNewRefusesToRunWithoutTheSandboxCustomer(t *testing.T) {
	cfg := Config{Sandbox: false, Owner: Owner{IDType: "CC", ID: "78965432"}}
	if _, err := New(cfg); !errors.Is(err, ErrNoOwner) {
		t.Fatalf("outside the sandbox: got %v", err)
	}
	cfg = Config{Sandbox: true}
	if _, err := New(cfg); !errors.Is(err, ErrNoOwner) {
		t.Fatalf("without an owner: got %v", err)
	}
}

func TestExchangeAndRefreshUseTheTokenEndpoint(t *testing.T) {
	a, bank, _ := setup(t)
	tokens, err := a.ExchangeCode(context.Background(), ports.CodeExchange{
		Code: "vRZs_yPSuzsap3BIW9w7CmzgEgJ3MFCsLVkAAAAE", CodeVerifier: "verifier-1", RedirectURI: "fynk://bank/callback",
	})
	if err != nil {
		t.Fatal(err)
	}
	if tokens.AccessToken != "zlJojElfSalTBc1CKVwi3adSHPpr" || tokens.RefreshToken == "" || tokens.ExpiresIn != 599*time.Second {
		t.Fatalf("tokens %+v", tokens)
	}
	f := bank.calls[0].form
	if f.Get("grant_type") != "authorization_code" || f.Get("code_verifier") != "verifier-1" ||
		f.Get("redirect_uri") != "fynk://bank/callback" || f.Get("scope") != tokenScope {
		t.Fatalf("exchange form %v", f)
	}
	if _, err := a.Refresh(context.Background(), "old-refresh"); err != nil {
		t.Fatal(err)
	}
	if f := bank.calls[1].form; f.Get("grant_type") != "refresh_token" || f.Get("refresh_token") != "old-refresh" {
		t.Fatalf("refresh form %v", f)
	}
}

func TestErrorsMapToThePortErrorsWithoutTheBanksText(t *testing.T) {
	a, bank, _ := setup(t)
	bank.answers["POST /auth/token"] = jsonAnswer(400, `{"error":"invalid_grant","error_description":"Pepito Perez"}`)
	_, err := a.Refresh(context.Background(), "old")
	if !errors.Is(err, ports.ErrInvalidGrant) || strings.Contains(err.Error(), "Pepito") || strings.Contains(err.Error(), "market-secret") {
		t.Fatalf("invalid grant: %v", err)
	}

	a, bank, _ = setup(t)
	bank.answers["POST /auth/token"] = func(w http.ResponseWriter) {
		w.Header().Set("Retry-After", "7")
		w.WriteHeader(http.StatusTooManyRequests)
	}
	var limited *ports.RateLimitedError
	if _, err := a.Refresh(context.Background(), "old"); !errors.As(err, &limited) || limited.RetryAfter != 7*time.Second {
		t.Fatalf("429: %v", err)
	}
}

func TestRevokeIsNotSupportedAndThereAreNoProducts(t *testing.T) {
	a, bank, _ := setup(t)
	if err := a.RevokeConsent(context.Background(), "ndgn1c0n63ntok"); !errors.Is(err, ports.ErrRevocationNotSupported) {
		t.Fatalf("revoke: %v", err)
	}
	if p, err := a.Products(context.Background()); p != nil || err != nil {
		t.Fatalf("products %v, %v", p, err)
	}
	if len(bank.calls) != 0 {
		t.Fatalf("calls %v", bank.calls)
	}
}
