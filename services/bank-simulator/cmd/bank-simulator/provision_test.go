package main

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

const jwtBearerType = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"

func fakeJWT(clientID string) string {
	h := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"PS256"}`))
	p := base64.RawURLEncoding.EncodeToString([]byte(fmt.Sprintf(`{"iss":%q,"sub":%q,"exp":%d}`, clientID, clientID, time.Now().Add(time.Hour).Unix())))
	return h + "." + p + "." + base64.RawURLEncoding.EncodeToString([]byte("sig"))
}

type provisionEnv struct {
	t     *testing.T
	store *store.BankStore
	mux   http.Handler
}

func newProvisionEnv(t *testing.T) *provisionEnv {
	s := store.NewBankStore(time.Time{})
	return &provisionEnv{t: t, store: s, mux: newBankMux(s, "fynk")}
}

// clientToken calls client_credentials and returns the status and access token.
func (e *provisionEnv) clientToken(clientID, scope string, withAssertion bool) (int, string, string) {
	form := url.Values{"grant_type": {"client_credentials"}, "client_id": {clientID}}
	if scope != "" {
		form.Set("scope", scope)
	}
	if withAssertion {
		form.Set("client_assertion_type", jwtBearerType)
		form.Set("client_assertion", fakeJWT(clientID))
	}
	req := httptest.NewRequest(http.MethodPost, "/oauth/token", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()
	e.mux.ServeHTTP(rec, req)
	var body struct {
		AccessToken string `json:"access_token"`
		Error       string `json:"error"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body.AccessToken, body.Error
}

func (e *provisionEnv) provisionToken() string {
	status, tok, errCode := e.clientToken("fynk", "demo:provision", true)
	if status != http.StatusOK {
		e.t.Fatalf("provision token: %d %s", status, errCode)
	}
	return tok
}

func (e *provisionEnv) provision(h http.Handler, token, body string, mtls bool) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "https://bank-simulator:9443/demo/v1/customers", strings.NewReader(body))
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if mtls {
		req.TLS = &tls.ConnectionState{PeerCertificates: []*x509.Certificate{{}}}
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func refBody(ref string) string { return fmt.Sprintf(`{"customerRef":%q}`, ref) }

func TestProvision_IdempotentAndPerCustomer(t *testing.T) {
	e := newProvisionEnv(t)
	tok := e.provisionToken()

	first := e.provision(e.mux, tok, refBody("sub-0001"), true)
	second := e.provision(e.mux, tok, refBody("sub-0001"), true)
	if first.Code != http.StatusOK || first.Body.String() != second.Body.String() {
		t.Fatalf("same call must give the same answer: %d %s vs %s", first.Code, first.Body, second.Body)
	}
	var res struct {
		Entities []struct {
			ProviderID, DisplayName, Kind string
			AccountCount                  int
		} `json:"entities"`
	}
	if err := json.Unmarshal(first.Body.Bytes(), &res); err != nil || len(res.Entities) < 2 {
		t.Fatalf("expected at least two entities, got %s", first.Body)
	}
	if res.Entities[0].ProviderID != domain.ProviderBancoDemo || res.Entities[0].AccountCount < 1 {
		t.Errorf("unexpected first entity: %+v", res.Entities[0])
	}

	// Different customers can differ.
	differs := false
	for i := 2; i < 40 && !differs; i++ {
		other := e.provision(e.mux, tok, refBody(fmt.Sprintf("sub-%04d", i)), true)
		differs = other.Body.String() != first.Body.String()
	}
	if !differs {
		t.Error("expected at least one customer with a different entity list")
	}
}

func TestProvision_DemoCustomerHasItsTwoEntities(t *testing.T) {
	e := newProvisionEnv(t)
	rec := e.provision(e.mux, e.provisionToken(), refBody(domain.DemoCustomerID), true)
	var res struct {
		Entities []struct {
			ProviderID string `json:"providerId"`
		} `json:"entities"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if rec.Code != http.StatusOK || len(res.Entities) != 2 {
		t.Fatalf("expected the demo user's two entities, got %d %s", rec.Code, rec.Body)
	}
}

func TestProvision_AccessRules(t *testing.T) {
	e := newProvisionEnv(t)
	good := e.provisionToken()
	_, noScope, _ := e.clientToken("fynk", "", true)
	e.store.IssueToken("cc-expired", store.TokenRecord{Kind: store.TokenKindClient, Scope: "demo:provision", ExpiresAt: time.Now().Add(-time.Second)})
	e.store.IssueToken("at-access", store.TokenRecord{Kind: store.TokenKindAccess, ConsentID: "consent-demo-001", ExpiresAt: time.Now().Add(time.Minute)})

	cases := []struct {
		name  string
		token string
		mtls  bool
		want  int
	}{
		{"no client certificate", good, false, http.StatusNotFound},
		{"no token", "", true, http.StatusUnauthorized},
		{"unknown token", "cc-unknown", true, http.StatusUnauthorized},
		{"expired token", "cc-expired", true, http.StatusUnauthorized},
		{"consent access token", "at-access", true, http.StatusUnauthorized},
		{"client token without the scope", noScope, true, http.StatusForbidden},
	}
	for _, c := range cases {
		rec := e.provision(e.mux, c.token, refBody("sub-0001"), c.mtls)
		if rec.Code != c.want {
			t.Errorf("%s: expected %d, got %d", c.name, c.want, rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); ct != "application/problem+json" {
			t.Errorf("%s: expected problem+json, got %q", c.name, ct)
		}
	}
}

func TestProvision_RejectsBadBodies(t *testing.T) {
	e := newProvisionEnv(t)
	tok := e.provisionToken()
	bodies := map[string]string{
		"email":        refBody("person@example.com"),
		"empty":        refBody(""),
		"too long":     refBody(strings.Repeat("a", 200)),
		"missing":      `{}`,
		"not json":     `customerRef=sub-1`,
		"body too big": `{"customerRef":"a","pad":"` + strings.Repeat("x", 5000) + `"}`,
	}
	for name, body := range bodies {
		if rec := e.provision(e.mux, tok, body, true); rec.Code != http.StatusBadRequest {
			t.Errorf("%s: expected 400, got %d", name, rec.Code)
		}
	}
}

func TestClientCredentials_Scopes(t *testing.T) {
	e := newProvisionEnv(t)

	status, tok, errCode := e.clientToken("other-client", "demo:provision", true)
	if status != http.StatusBadRequest || errCode != "invalid_scope" || tok != "" {
		t.Errorf("provision scope for another client: got %d %q", status, errCode)
	}
	if status, _, errCode := e.clientToken("fynk", "admin", true); status != http.StatusBadRequest || errCode != "invalid_scope" {
		t.Errorf("unknown scope: got %d %q", status, errCode)
	}
	if status, _, errCode := e.clientToken("fynk", "demo:provision", false); status != http.StatusUnauthorized || errCode != "invalid_client" {
		t.Errorf("no assertion: got %d %q", status, errCode)
	}
	// The call that consent revocation uses: no scope asked for.
	status, tok, _ = e.clientToken("fynk", "", true)
	if status != http.StatusOK || tok == "" {
		t.Fatalf("no-scope client_credentials must still work, got %d", status)
	}
	rec, ok := e.store.LookupToken(tok)
	if !ok || rec.Kind != store.TokenKindClient || rec.ConsentID != "" {
		t.Errorf("client token not registered as kind client: %+v", rec)
	}
}

func TestProvision_NeverLogsTheCustomerRef(t *testing.T) {
	e := newProvisionEnv(t)
	tok := e.provisionToken()
	const ref = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

	var logs bytes.Buffer
	h := logClientCert(slog.New(slog.NewJSONHandler(&logs, nil)), e.mux)
	req := httptest.NewRequest(http.MethodPost, "https://bank-simulator:9443/demo/v1/customers", strings.NewReader(refBody(ref)))
	req.Header.Set("Authorization", "Bearer "+tok)
	req.TLS = &tls.ConnectionState{PeerCertificates: []*x509.Certificate{{}}}
	req.TLS.PeerCertificates[0].SerialNumber = big.NewInt(1)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if logs.Len() == 0 {
		t.Fatal("expected the mTLS log line, so the capture is proven to work")
	}
	for _, secret := range []string{ref, tok} {
		if strings.Contains(logs.String(), secret) {
			t.Errorf("a secret appeared in the logs: %s", logs.String())
		}
	}
}
