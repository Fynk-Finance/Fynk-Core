package oauth

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

const (
	testVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	assertionTyp = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
)

var storeRef = time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)

type env struct {
	t     *testing.T
	store *store.BankStore
	svc   *Service
	ts    *httptest.Server
}

func newEnv(t *testing.T) *env {
	t.Helper()
	s := store.NewBankStore(time.Time{})
	svc := NewService(s)
	mux := http.NewServeMux()
	svc.RegisterRoutes(mux)
	ts := httptest.NewServer(mux)
	t.Cleanup(ts.Close)
	return &env{t: t, store: s, svc: svc, ts: ts}
}

func (e *env) post(path string, form url.Values) (int, map[string]any) {
	e.t.Helper()
	resp, err := http.PostForm(e.ts.URL+path, form)
	if err != nil {
		e.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var body map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

func parForm(entity string) url.Values {
	h := sha256.Sum256([]byte(testVerifier))
	f := url.Values{
		"client_id":             {"fynk"},
		"redirect_uri":          {"fynk://bank/callback"},
		"scope":                 {"accounts transactions"},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(h[:])},
		"code_challenge_method": {"S256"},
		"state":                 {"state-1"},
		"client_assertion_type": {assertionTyp},
		"client_assertion":      {makeFakeJWT("PS256", "fynk", "fynk", time.Now().Add(time.Hour))},
	}
	if entity != "" {
		f.Set("entity", entity)
	}
	return f
}

type linked struct {
	consentID, access, refresh string
}

// link runs PAR, authorization and the code exchange for a customer and an entity.
func (e *env) link(customerID, entity string) linked {
	e.t.Helper()
	status, par := e.post("/oauth/par", parForm(entity))
	if status != http.StatusCreated {
		e.t.Fatalf("PAR: expected 201, got %d", status)
	}
	code, _, err := e.svc.CompleteAuthorization(par["request_uri"].(string), customerID)
	if err != nil {
		e.t.Fatalf("authorize: %v", err)
	}
	status, tok := e.post("/oauth/token", url.Values{
		"grant_type": {"authorization_code"}, "code": {code}, "code_verifier": {testVerifier},
		"client_id": {"fynk"}, "redirect_uri": {"fynk://bank/callback"},
		"client_assertion_type": {assertionTyp}, "client_assertion": parForm("")["client_assertion"],
	})
	if status != http.StatusOK {
		e.t.Fatalf("token: expected 200, got %d", status)
	}
	return linked{par["consent_id"].(string), tok["access_token"].(string), tok["refresh_token"].(string)}
}

func entityOf(customerID string) map[string]bool {
	out := map[string]bool{}
	for _, s := range domain.EntitySummaries(domain.GenerateCustomerData(customerID, storeRef)) {
		out[s.ProviderID] = true
	}
	return out
}

// findCustomer returns a customer id with an account at have and none at missing ("" for any).
func findCustomer(t *testing.T, have, missing string) string {
	t.Helper()
	for i := 0; i < 2000; i++ {
		id := fmt.Sprintf("sub-%04d", i)
		ents := entityOf(id)
		if ents[have] && (missing == "" || !ents[missing]) {
			return id
		}
	}
	t.Fatalf("no customer with %s and without %s", have, missing)
	return ""
}

func TestPAR_RequiresKnownEntity(t *testing.T) {
	e := newEnv(t)
	for _, entity := range []string{"", "bancolombia", "BANCO-DEMO"} {
		status, body := e.post("/oauth/par", parForm(entity))
		if status != http.StatusBadRequest || body["error"] != "invalid_request" {
			t.Errorf("entity %q: expected 400 invalid_request, got %d %v", entity, status, body)
		}
	}
}

func TestPAR_CreatesPendingConsentWithoutCustomer(t *testing.T) {
	e := newEnv(t)
	f := parForm(domain.ProviderBancoDigitalDemo)
	f.Set("nonce", "n-1")
	f.Set("fynk_consent_id", "fc-1")
	status, par := e.post("/oauth/par", f)
	if status != http.StatusCreated {
		t.Fatalf("expected 201, got %d", status)
	}
	c, err := e.store.GetConsent(par["consent_id"].(string))
	if err != nil {
		t.Fatal(err)
	}
	if c.Status != domain.ConsentStatusPending || c.CustomerID != "" || c.ProviderID != domain.ProviderBancoDigitalDemo {
		t.Errorf("unexpected consent: %+v", c)
	}
	data := e.svc.parData[par["request_uri"].(string)]
	if data.Nonce != "n-1" || data.FynkConsentID != "fc-1" || data.ProviderID != domain.ProviderBancoDigitalDemo {
		t.Errorf("PAR data not kept: %+v", data)
	}
}

func TestCompleteAuthorization_NoProductsKeepsConsentPending(t *testing.T) {
	e := newEnv(t)
	cust := findCustomer(t, domain.ProviderBancoDemo, domain.ProviderBancoDigitalDemo)
	_, par := e.post("/oauth/par", parForm(domain.ProviderBancoDigitalDemo))

	_, _, err := e.svc.CompleteAuthorization(par["request_uri"].(string), cust)
	if !errors.Is(err, store.ErrNoProductsAtEntity) {
		t.Fatalf("expected ErrNoProductsAtEntity, got %v", err)
	}
	c, _ := e.store.GetConsent(par["consent_id"].(string))
	if c.Status != domain.ConsentStatusPending || c.CustomerID != "" {
		t.Errorf("consent should stay pending without customer: %+v", c)
	}
}

func TestTokens_AreOpaqueAndTiedToTheirConsent(t *testing.T) {
	e := newEnv(t)
	cust := findCustomer(t, domain.ProviderBancoDigitalDemo, "")
	l := e.link(cust, domain.ProviderBancoDigitalDemo)

	if strings.Contains(l.access, l.consentID) || strings.Contains(l.refresh, l.consentID) {
		t.Error("tokens must not contain the consent id")
	}
	rec, ok := e.store.LookupToken(l.access)
	if !ok || rec.Kind != store.TokenKindAccess || rec.ConsentID != l.consentID {
		t.Errorf("access token not registered for its consent: %+v", rec)
	}
	accounts, err := e.store.GetAccounts(l.consentID)
	if err != nil || len(accounts) == 0 {
		t.Fatalf("expected accounts, got %v %v", len(accounts), err)
	}
	for _, a := range accounts {
		if a.ProviderID != domain.ProviderBancoDigitalDemo {
			t.Errorf("account of %s in a banco-digital-demo consent", a.ProviderID)
		}
	}
}

func TestRefresh_UnknownTokenAndAfterRevoke(t *testing.T) {
	e := newEnv(t)
	status, body := e.post("/oauth/token", url.Values{"grant_type": {"refresh_token"}, "refresh_token": {"rt-unknown"}})
	if status != http.StatusBadRequest || body["error"] != "invalid_grant" {
		t.Errorf("unknown token: expected 400 invalid_grant, got %d %v", status, body)
	}

	// An access token is not a refresh token.
	cust := findCustomer(t, domain.ProviderBancoDemo, "")
	l := e.link(cust, domain.ProviderBancoDemo)
	status, body = e.post("/oauth/token", url.Values{"grant_type": {"refresh_token"}, "refresh_token": {l.access}})
	if status != http.StatusBadRequest || body["error"] != "invalid_grant" {
		t.Errorf("access token as refresh: expected invalid_grant, got %d %v", status, body)
	}

	// A good refresh works and keeps the same consent.
	status, body = e.post("/oauth/token", url.Values{"grant_type": {"refresh_token"}, "refresh_token": {l.refresh}})
	if status != http.StatusOK || body["consent_id"] != l.consentID {
		t.Fatalf("refresh: expected 200 for the same consent, got %d %v", status, body)
	}

	_ = e.store.RevokeConsent(l.consentID)
	status, body = e.post("/oauth/token", url.Values{"grant_type": {"refresh_token"}, "refresh_token": {l.refresh}})
	if status != http.StatusBadRequest || body["error"] != "invalid_grant" {
		t.Errorf("after revoke: expected invalid_grant, got %d %v", status, body)
	}
}

func TestRevoke_OnlyRevokesTheTokensConsent(t *testing.T) {
	e := newEnv(t)
	cust := findCustomer(t, domain.ProviderBancoDigitalDemo, "")
	bd := e.link(cust, domain.ProviderBancoDemo)
	digital := e.link(cust, domain.ProviderBancoDigitalDemo)

	if status, _ := e.post("/oauth/revoke", url.Values{"token": {bd.access}}); status != http.StatusOK {
		t.Fatalf("expected 200, got %d", status)
	}
	if _, err := e.store.GetAccounts(bd.consentID); !errors.Is(err, store.ErrConsentRevoked) {
		t.Errorf("revoked consent: got %v", err)
	}
	if _, err := e.store.GetAccounts(digital.consentID); err != nil {
		t.Errorf("the other entity's consent should still work: %v", err)
	}
	demo, _ := e.store.GetConsent("consent-demo-001")
	if demo.Status != domain.ConsentStatusActive {
		t.Error("the demo consent must not be touched")
	}
}

func TestRevoke_UnknownTokenIsNoOp(t *testing.T) {
	e := newEnv(t)
	for _, tok := range []string{"at-unknown", "consent-demo-001", "dev-token", ""} {
		if status, _ := e.post("/oauth/revoke", url.Values{"token": {tok}}); status != http.StatusOK {
			t.Errorf("token %q: expected 200, got %d", tok, status)
		}
	}
	demo, _ := e.store.GetConsent("consent-demo-001")
	if demo.Status != domain.ConsentStatusActive {
		t.Error("an unknown token must not revoke the demo consent")
	}
}
