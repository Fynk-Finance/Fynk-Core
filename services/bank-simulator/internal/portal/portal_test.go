package portal

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/api"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

func setupTestServer() (*httptest.Server, *store.BankStore) {
	refTime := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	s := store.NewBankStore(refTime)
	pHandler := NewHandler(s)
	apiHandler := api.NewHandler(s)

	mux := http.NewServeMux()
	pHandler.RegisterRoutes(mux)
	apiHandler.RegisterRoutes(mux)

	return httptest.NewServer(mux), s
}

func TestPortalDashboardAndBanner(t *testing.T) {
	ts, _ := setupTestServer()
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/portal")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	html := string(bodyBytes)

	if !strings.Contains(html, "Banco simulado para pruebas. No es un banco real.") {
		t.Errorf("missing simulation banner in HTML")
	}
	if !strings.Contains(html, "Cuenta de Ahorros Demo") {
		t.Errorf("missing accounts in dashboard")
	}
}

// TestPaymentCreatedInPortalAppearsInAPIImmediately validates the explicit Jira criteria:
// "A payment created in the portal appears in GET .../transactions immediately."
func TestPaymentCreatedInPortalAppearsInAPIImmediately(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()

	customerID := "cliente.demo@bancodemo.local"
	custData := s.GetCustomer(customerID)
	ahorrosID := custData.Accounts[0].ID

	// 1. Post a new payment via the portal
	form := url.Values{
		"account_id": {ahorrosID},
		"merchant":   {"RESTAURANTE EL CHEF DEMO"},
		"category":   {"restaurants"},
		"amount":     {"78500"},
	}

	resp, err := http.PostForm(ts.URL+"/portal/actions/pay", form)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	// Redirect expected
	if resp.StatusCode != http.StatusSeeOther && resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusFound {
		t.Fatalf("unexpected status code on post: %d", resp.StatusCode)
	}

	// 2. Immediately call the Open Finance resource API
	apiReq, _ := http.NewRequest(http.MethodGet, ts.URL+"/open-finance/v1/accounts/"+ahorrosID+"/transactions?pageSize=5", nil)
	apiReq.Header.Set("Authorization", "Bearer dev-token")

	apiResp, err := http.DefaultClient.Do(apiReq)
	if err != nil {
		t.Fatalf("API request failed: %v", err)
	}
	defer func() { _ = apiResp.Body.Close() }()

	if apiResp.StatusCode != http.StatusOK {
		t.Fatalf("API returned %d", apiResp.StatusCode)
	}

	var txRes struct {
		Data []domain.Transaction `json:"data"`
	}
	if err := json.NewDecoder(apiResp.Body).Decode(&txRes); err != nil {
		t.Fatalf("failed to decode transactions: %v", err)
	}

	if len(txRes.Data) == 0 {
		t.Fatalf("no transactions returned by API")
	}

	// The newest transaction MUST be our just-recorded payment
	newest := txRes.Data[0]
	if newest.Description != "PAGO RESTAURANTE EL CHEF DEMO" {
		t.Errorf("expected newest tx to be 'PAGO RESTAURANTE EL CHEF DEMO', got '%s'", newest.Description)
	}
	if newest.AmountMinor != -7850000 {
		t.Errorf("expected -7850000 minor, got %d", newest.AmountMinor)
	}
}

func TestPortalTransferAndCardPayment(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()

	customerID := "cliente.demo@bancodemo.local"
	custData := s.GetCustomer(customerID)
	ahorrosID := custData.Accounts[0].ID
	walletID := custData.Accounts[1].ID
	cardID := custData.Accounts[2].ID

	// Transfer from Ahorros to Wallet
	trfForm := url.Values{
		"from_account": {ahorrosID},
		"to_account":   {walletID},
		"amount":       {"200000"},
	}
	resp, _ := http.PostForm(ts.URL+"/portal/actions/transfer", trfForm)
	_ = resp.Body.Close()

	// Pay Card from Ahorros
	cardForm := url.Values{
		"from_account": {ahorrosID},
		"card_account": {cardID},
		"amount":       {"300000"},
	}
	resp2, _ := http.PostForm(ts.URL+"/portal/actions/pay-card", cardForm)
	_ = resp2.Body.Close()

	// Verify updated balances in store
	updated := s.GetCustomer(customerID)
	// Ahorros was 3.2M - 200k - 300k = 2.7M
	var updatedAhorros *domain.Account
	for i := range updated.Accounts {
		if updated.Accounts[i].ID == ahorrosID {
			updatedAhorros = &updated.Accounts[i]
			break
		}
	}
	if updatedAhorros.BalanceMinor != 270000000 {
		t.Errorf("expected Ahorros balance 270000000, got %d", updatedAhorros.BalanceMinor)
	}
}

func TestPortalSubscriptionsAndAdmin(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()

	customerID := "cliente.demo@bancodemo.local"
	custData := s.GetCustomer(customerID)
	subID := custData.Subscriptions[0].ID

	// Change subscription price
	priceForm := url.Values{
		"sub_id":     {subID},
		"new_amount": {"45900"},
	}
	resp, _ := http.PostForm(ts.URL+"/portal/subscriptions/change-price", priceForm)
	_ = resp.Body.Close()

	// Charge subscription immediately
	chargeForm := url.Values{
		"sub_id": {subID},
	}
	resp2, _ := http.PostForm(ts.URL+"/portal/subscriptions/charge-now", chargeForm)
	_ = resp2.Body.Close()

	// Reset via admin
	resp3, _ := http.PostForm(ts.URL+"/portal/admin/reset", url.Values{})
	_ = resp3.Body.Close()

	// Verify reset restored original balance
	resetCust := s.GetCustomer(customerID)
	if resetCust.Accounts[0].BalanceMinor != 320000000 {
		t.Errorf("expected reset balance 320000000, got %d", resetCust.Accounts[0].BalanceMinor)
	}
}

func TestParseMoneyInput(t *testing.T) {
	for in, want := range map[string]int64{
		"78500":       78_500_00,
		"1.250.000":   1_250_000_00,
		"$ 1.250.000": 1_250_000_00,
		"1.250,50":    1_250_50,
		"1250,5":      1_250_50,
		"1000.50":     1_000_50, // a decimal point, not 100.050 pesos
		"12.5":        12_50,
		"1.000":       1_000_00, // three digits after the point: thousands
		"0,50":        50,
	} {
		got, err := parseMoneyInput(in)
		if err != nil || got != want {
			t.Errorf("parseMoneyInput(%q) = %d, %v; want %d", in, got, err, want)
		}
	}
	for _, in := range []string{"", "abc", "-500", "-0,50", "1,ab", "1,505", "12a", ",50", "99999999999999999999"} {
		if got, err := parseMoneyInput(in); err == nil {
			t.Errorf("parseMoneyInput(%q) = %d, want an error", in, got)
		}
	}
}

// balanceOf reads the balance of one account from the store.
func balanceOf(s *store.BankStore, customerID, accountID string) int64 {
	for _, a := range s.GetCustomer(customerID).Accounts {
		if a.ID == accountID {
			return a.BalanceMinor
		}
	}
	return 0
}

func TestPortalRefusesATransferBiggerThanTheBalance(t *testing.T) {
	ts, s := setupTestServer()
	defer ts.Close()
	customerID := "cliente.demo@bancodemo.local"
	accounts := s.GetCustomer(customerID).Accounts
	ahorrosID, walletID := accounts[0].ID, accounts[1].ID
	before := balanceOf(s, customerID, ahorrosID)

	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	resp, err := client.PostForm(ts.URL+"/portal/actions/transfer", url.Values{
		"from_account": {ahorrosID},
		"to_account":   {walletID},
		"amount":       {"999.999.999"},
	})
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()

	if got := balanceOf(s, customerID, ahorrosID); got != before {
		t.Errorf("balance went from %d to %d: the transfer must be refused", before, got)
	}
	if loc := resp.Header.Get("Location"); !strings.Contains(loc, "error=insufficient+funds") {
		t.Errorf("redirect = %q, want the insufficient funds error", loc)
	}
}
