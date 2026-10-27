package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

func setupTestServer() (*httptest.Server, *store.BankStore) {
	refTime := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	s := store.NewBankStore(refTime)
	h := NewHandler(s)

	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	return httptest.NewServer(mux), s
}

func TestGetAccounts_Unauthorized(t *testing.T) {
	ts, _ := setupTestServer()
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/open-finance/v1/accounts")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401 Unauthorized, got %d", resp.StatusCode)
	}
}

func TestGetAccounts_Success(t *testing.T) {
	ts, _ := setupTestServer()
	defer ts.Close()

	req, err := http.NewRequest("GET", ts.URL+"/open-finance/v1/accounts", nil)
	if err != nil {
		t.Fatalf("error creating request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer dev-token")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("error performing request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	var res struct {
		Data []domain.Account `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(res.Data) != 4 {
		t.Errorf("expected 4 accounts, got %d", len(res.Data))
	}
}

func TestGetTransactions_Pagination(t *testing.T) {
	ts, _ := setupTestServer()
	defer ts.Close()

	// Get accounts first to obtain an account ID
	req, _ := http.NewRequest("GET", ts.URL+"/open-finance/v1/accounts", nil)
	req.Header.Set("Authorization", "Bearer dev-token")
	resp, _ := http.DefaultClient.Do(req)
	var accRes struct {
		Data []domain.Account `json:"data"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&accRes)
	resp.Body.Close()

	accountID := accRes.Data[0].ID

	// Page 1 with pageSize=5
	req1, _ := http.NewRequest("GET", ts.URL+"/open-finance/v1/accounts/"+accountID+"/transactions?pageSize=5", nil)
	req1.Header.Set("Authorization", "Bearer dev-token")
	resp1, err := http.DefaultClient.Do(req1)
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	defer resp1.Body.Close()

	var txRes1 struct {
		Data []domain.Transaction `json:"data"`
		Meta struct {
			HasMore    bool   `json:"hasMore"`
			NextCursor string `json:"nextCursor"`
		} `json:"meta"`
	}
	_ = json.NewDecoder(resp1.Body).Decode(&txRes1)

	if len(txRes1.Data) != 5 {
		t.Errorf("expected 5 transactions in page 1, got %d", len(txRes1.Data))
	}
	if !txRes1.Meta.HasMore {
		t.Errorf("expected hasMore to be true")
	}
	if txRes1.Meta.NextCursor == "" {
		t.Errorf("expected nextCursor to be non-empty")
	}

	// Page 2 using cursor
	req2, _ := http.NewRequest("GET", ts.URL+"/open-finance/v1/accounts/"+accountID+"/transactions?pageSize=5&cursor="+txRes1.Meta.NextCursor, nil)
	req2.Header.Set("Authorization", "Bearer dev-token")
	resp2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	defer resp2.Body.Close()

	var txRes2 struct {
		Data []domain.Transaction `json:"data"`
	}
	_ = json.NewDecoder(resp2.Body).Decode(&txRes2)

	if len(txRes2.Data) != 5 {
		t.Errorf("expected 5 transactions in page 2, got %d", len(txRes2.Data))
	}
	if txRes1.Data[0].ID == txRes2.Data[0].ID {
		t.Errorf("cursor failed: page 1 and page 2 start with same transaction %s", txRes1.Data[0].ID)
	}
}

func TestRevokeConsent(t *testing.T) {
	ts, _ := setupTestServer()
	defer ts.Close()

	// Revoke consent
	req, _ := http.NewRequest("DELETE", ts.URL+"/open-finance/v1/consents/consent-demo-001", nil)
	req.Header.Set("Authorization", "Bearer dev-token")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("error revoking: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Errorf("expected 204 No Content, got %d", resp.StatusCode)
	}

	// Subsequent accounts call should fail with 403 consent_revoked
	req2, _ := http.NewRequest("GET", ts.URL+"/open-finance/v1/accounts", nil)
	req2.Header.Set("Authorization", "Bearer consent-demo-001")
	resp2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden after revocation, got %d", resp2.StatusCode)
	}

	var prob ProblemDetails
	_ = json.NewDecoder(resp2.Body).Decode(&prob)
	if prob.Code != "consent_revoked" {
		t.Errorf("expected code 'consent_revoked', got %s", prob.Code)
	}
}

func TestGetCdtProducts_Public(t *testing.T) {
	ts, _ := setupTestServer()
	defer ts.Close()

	// Public endpoint without Authorization header
	resp, err := http.Get(ts.URL + "/open-finance/v1/products/cdt")
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}

	var res struct {
		Data []domain.CdtProduct `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode: %v", err)
	}

	if len(res.Data) != 3 {
		t.Errorf("expected 3 CDT products, got %d", len(res.Data))
	}
}

func TestRateLimiter(t *testing.T) {
	rl := store.NewRateLimiter(3, time.Minute)
	now := time.Now()

	for i := 0; i < 3; i++ {
		allowed, _ := rl.Allow("test-key", now)
		if !allowed {
			t.Fatalf("request %d should have been allowed", i+1)
		}
	}

	allowed, retryAfter := rl.Allow("test-key", now)
	if allowed {
		t.Fatalf("request 4 should have been rate limited")
	}
	if retryAfter <= 0 {
		t.Errorf("expected positive retryAfter, got %d", retryAfter)
	}
}
