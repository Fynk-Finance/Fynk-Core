package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

var testRef = time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)

func hasEntity(id, provider string) bool {
	for _, e := range domain.EntitySummaries(domain.GenerateCustomerData(id, testRef)) {
		if e.ProviderID == provider {
			return true
		}
	}
	return false
}

// findCustomer returns a generated customer id that has every provider in with
// and none of the providers in without.
func findCustomer(t *testing.T, with []string, without ...string) string {
	t.Helper()
	for i := 0; i < 2000; i++ {
		id := fmt.Sprintf("sub-%04d", i)
		ok := true
		for _, p := range with {
			ok = ok && hasEntity(id, p)
		}
		for _, p := range without {
			ok = ok && !hasEntity(id, p)
		}
		if ok {
			return id
		}
	}
	t.Fatalf("no customer found for %v without %v", with, without)
	return ""
}

// link makes an active consent for the entity and an access token for it.
func link(t *testing.T, s *store.BankStore, consentID, customerID, provider string) string {
	t.Helper()
	s.CreatePendingConsent(consentID, "fynk", provider, []string{"accounts", "transactions"}, "test", 365)
	if err := s.ActivateConsent(consentID, customerID); err != nil {
		t.Fatalf("activate: %v", err)
	}
	token := "at-" + consentID
	s.IssueToken(token, store.TokenRecord{Kind: store.TokenKindAccess, ConsentID: consentID, ClientID: "fynk", ExpiresAt: time.Now().Add(time.Minute)})
	return token
}

func call(t *testing.T, ts *httptest.Server, method, path, token string) (int, []byte) {
	t.Helper()
	req, _ := http.NewRequest(method, ts.URL+path, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, body
}

func accountsOf(t *testing.T, ts *httptest.Server, token string) []domain.Account {
	t.Helper()
	status, body := call(t, ts, "GET", "/open-finance/v1/accounts", token)
	if status != http.StatusOK {
		t.Fatalf("accounts: expected 200, got %d: %s", status, body)
	}
	var res struct {
		Data []domain.Account `json:"data"`
	}
	if err := json.Unmarshal(body, &res); err != nil {
		t.Fatal(err)
	}
	return res.Data
}

func problemCode(body []byte) string {
	var p ProblemDetails
	_ = json.Unmarshal(body, &p)
	return p.Code
}

func TestScoping_ConsentReadsOnlyItsEntity(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()
	cust := findCustomer(t, []string{domain.ProviderBancoDemo, domain.ProviderBancoDigitalDemo})
	token := link(t, s, "consent-digital", cust, domain.ProviderBancoDigitalDemo)

	accounts := accountsOf(t, ts, token)
	if len(accounts) == 0 {
		t.Fatal("expected accounts at banco-digital-demo")
	}
	for _, a := range accounts {
		if a.ProviderID != domain.ProviderBancoDigitalDemo {
			t.Errorf("account of entity %s leaked into a banco-digital-demo consent", a.ProviderID)
		}
	}
}

func TestScoping_AccountOfAnotherEntityOrCustomerIs403(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()
	cust := findCustomer(t, []string{domain.ProviderBancoDemo, domain.ProviderBancoDigitalDemo})
	token := link(t, s, "consent-digital", cust, domain.ProviderBancoDigitalDemo)

	var sameCustomerOtherEntity string
	for _, a := range s.GetCustomer(cust).Accounts {
		if a.ProviderID == domain.ProviderBancoDemo {
			sameCustomerOtherEntity = a.ID
		}
	}
	otherCustomerAccount := s.GetCustomer("cliente.demo@bancodemo.local").Accounts[0].ID

	for name, id := range map[string]string{"other entity": sameCustomerOtherEntity, "other customer": otherCustomerAccount} {
		status, body := call(t, ts, "GET", "/open-finance/v1/accounts/"+id+"/transactions", token)
		if status != http.StatusForbidden || problemCode(body) != "account_not_in_consent" {
			t.Errorf("%s: expected 403 account_not_in_consent, got %d %s", name, status, body)
		}
	}

	status, _ := call(t, ts, "GET", "/open-finance/v1/accounts/acc-nowhere/transactions", token)
	if status != http.StatusNotFound {
		t.Errorf("unknown account: expected 404, got %d", status)
	}
}

func TestScoping_UnknownAndExpiredTokensGet401(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()
	s.IssueToken("at-old", store.TokenRecord{Kind: store.TokenKindAccess, ConsentID: "consent-demo-001", ExpiresAt: time.Now().Add(-time.Second)})
	s.IssueToken("rt-refresh", store.TokenRecord{Kind: store.TokenKindRefresh, ConsentID: "consent-demo-001", ExpiresAt: time.Now().Add(time.Hour)})

	for _, token := range []string{"random-token", "consent-demo-001", "at-old", "rt-refresh"} {
		status, _ := call(t, ts, "GET", "/open-finance/v1/accounts", token)
		if status != http.StatusUnauthorized {
			t.Errorf("token %q: expected 401, got %d", token, status)
		}
	}
}

func TestScoping_PendingConsentGets403(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()
	s.CreatePendingConsent("consent-pending", "fynk", domain.ProviderBancoDemo, []string{"accounts"}, "test", 365)
	s.IssueToken("at-pending", store.TokenRecord{Kind: store.TokenKindAccess, ConsentID: "consent-pending", ExpiresAt: time.Now().Add(time.Minute)})

	status, body := call(t, ts, "GET", "/open-finance/v1/accounts", "at-pending")
	if status != http.StatusForbidden || problemCode(body) != "consent_not_authorized" {
		t.Errorf("expected 403 consent_not_authorized, got %d %s", status, body)
	}
}

func TestScoping_RevokeByIdLeavesOtherEntityWorking(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()
	cust := findCustomer(t, []string{domain.ProviderBancoDemo, domain.ProviderBancoDigitalDemo})
	tokenBD := link(t, s, "consent-bd", cust, domain.ProviderBancoDemo)
	tokenDigital := link(t, s, "consent-digital", cust, domain.ProviderBancoDigitalDemo)

	if status, _ := call(t, ts, "DELETE", "/open-finance/v1/consents/consent-bd", tokenBD); status != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", status)
	}
	status, body := call(t, ts, "GET", "/open-finance/v1/accounts", tokenBD)
	if status != http.StatusForbidden || problemCode(body) != "consent_revoked" {
		t.Errorf("revoked consent: expected 403 consent_revoked, got %d %s", status, body)
	}
	if len(accountsOf(t, ts, tokenDigital)) == 0 {
		t.Error("the other entity's consent should still work")
	}
}

func TestScoping_DevTokenStillReadsDemoUser(t *testing.T) {
	ts, _ := setupTestServer()
	defer ts.Close()
	for _, token := range []string{"dev-token", "test-token"} {
		if n := len(accountsOf(t, ts, token)); n != 4 {
			t.Errorf("%s: expected the 4 demo accounts, got %d", token, n)
		}
	}
}

func TestScoping_RevokeNeedsTheConsentsTokenOrAClientToken(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()
	cust := findCustomer(t, []string{domain.ProviderBancoDemo, domain.ProviderBancoDigitalDemo})
	tokenBD := link(t, s, "consent-bd", cust, domain.ProviderBancoDemo)
	link(t, s, "consent-digital", cust, domain.ProviderBancoDigitalDemo)
	s.IssueToken("cc-fynk", store.TokenRecord{Kind: store.TokenKindClient, ClientID: "fynk", Scope: "admin", ExpiresAt: time.Now().Add(time.Minute)})

	cases := []struct {
		consent, token string
		want           int
	}{
		{"consent-digital", "", http.StatusUnauthorized},
		{"consent-digital", "unknown", http.StatusUnauthorized},
		{"consent-digital", tokenBD, http.StatusForbidden},
		{"consent-digital", "dev-token", http.StatusForbidden},
		{"consent-digital", "cc-fynk", http.StatusNoContent},
		{"consent-bd", tokenBD, http.StatusNoContent},
	}
	for _, c := range cases {
		if status, body := call(t, ts, "DELETE", "/open-finance/v1/consents/"+c.consent, c.token); status != c.want {
			t.Errorf("revoke %s with %q: expected %d, got %d %s", c.consent, c.token, c.want, status, body)
		}
	}
}
