package bankdemo

import (
	"context"
	"encoding/json"
	"errors"
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

// fakeBank answers like contracts/bank-simulator.yaml and records what it received.
type fakeBank struct {
	mu       sync.Mutex
	forms    map[string]url.Values // path -> last form
	auth     map[string]string     // path -> Authorization header
	queries  []url.Values
	revoked  []string
	status   int // forced status for resource calls, 0 = normal
	retry    string
	problem  string
	accounts string
}

func (f *fakeBank) handler() http.Handler {
	mux := http.NewServeMux()
	form := func(w http.ResponseWriter, r *http.Request) url.Values {
		_ = r.ParseForm()
		f.mu.Lock()
		f.forms[r.URL.Path] = r.PostForm
		f.auth[r.URL.Path] = r.Header.Get("Authorization")
		f.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		return r.PostForm
	}
	mux.HandleFunc("POST /oauth/par", func(w http.ResponseWriter, r *http.Request) {
		form(w, r)
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"request_uri":"urn:ietf:params:oauth:request_uri:par-1","expires_in":300,"consent_id":"consent-abc"}`))
	})
	mux.HandleFunc("POST /oauth/token", func(w http.ResponseWriter, r *http.Request) {
		v := form(w, r)
		switch v.Get("grant_type") {
		case "authorization_code":
			if v.Get("code") == "bad" {
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"error":"invalid_grant","error_description":"authorization code is invalid or expired"}`))
				return
			}
			_, _ = w.Write([]byte(`{"access_token":"at-1","refresh_token":"rt-1","expires_in":300,"token_type":"Bearer","consent_id":"consent-abc"}`))
		case "refresh_token":
			_, _ = w.Write([]byte(`{"access_token":"at-2","refresh_token":"rt-2","expires_in":300,"token_type":"Bearer","consent_id":"consent-abc"}`))
		case "client_credentials":
			_, _ = w.Write([]byte(`{"access_token":"cc-1","expires_in":300,"token_type":"Bearer"}`))
		}
	})
	mux.HandleFunc("GET /open-finance/v1/accounts", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.auth[r.URL.Path] = r.Header.Get("Authorization")
		f.mu.Unlock()
		if f.fail(w) {
			return
		}
		_, _ = w.Write([]byte(f.accounts))
	})
	mux.HandleFunc("GET /open-finance/v1/accounts/{id}/transactions", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.queries = append(f.queries, r.URL.Query())
		f.mu.Unlock()
		if f.fail(w) {
			return
		}
		if r.URL.Query().Get("cursor") == "" {
			_, _ = w.Write([]byte(`{"data":[
				{"id":"tx-2","accountId":"acc-1","bookingDateTime":"2026-10-30T08:00:00Z","amount":"+5200000.00","amountMinor":520000000,"status":"BOOKED","description":"NOMINA EMPRESA DEMO SAS","merchantName":"EMPRESA DEMO SAS","category":"salary","simulated":true},
				{"id":"tx-1","accountId":"acc-1","bookingDateTime":"2026-10-29T12:00:00Z","amount":"-18430.00","amountMinor":-1843000,"status":"PENDING","description":"COMPRA MERCADO","merchantName":null,"category":null,"simulated":true}
			],"meta":{"hasMore":true,"nextCursor":"page-2"}}`))
			return
		}
		_, _ = w.Write([]byte(`{"data":[],"meta":{"hasMore":false,"nextCursor":null}}`))
	})
	mux.HandleFunc("DELETE /open-finance/v1/consents/{id}", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.auth[r.URL.Path] = r.Header.Get("Authorization")
		f.revoked = append(f.revoked, r.PathValue("id"))
		f.mu.Unlock()
		if r.PathValue("id") == "gone" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	mux.HandleFunc("GET /open-finance/v1/products/cdt", func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		f.auth[r.URL.Path] = r.Header.Get("Authorization")
		f.mu.Unlock()
		_, _ = w.Write([]byte(`{"data":[{"id":"cdt-demo-180","name":"CDT Digital Banco Demo 180 Días","termDays":180,"rateEa":10.5,"rateEaBps":1050,"minAmount":"500000.00","minAmountMinor":50000000,"risk":"low"}]}`))
	})
	return mux
}

func (f *fakeBank) fail(w http.ResponseWriter) bool {
	if f.status == 0 {
		return false
	}
	if f.retry != "" {
		w.Header().Set("Retry-After", f.retry)
	}
	w.Header().Set("Content-Type", "application/problem+json")
	w.WriteHeader(f.status)
	_, _ = w.Write([]byte(`{"code":"` + f.problem + `","detail":"secret-detail-from-bank"}`))
	return true
}

const allAccounts = `{"data":[
 {"id":"acc-ahorros","type":"SAVINGS","name":"Cuenta de Ahorros Demo","maskedNumber":"****4821","currency":"COP","balance":"3200000.00","balanceMinor":320000000,"available":"3200000.00","availableMinor":320000000,"status":"ACTIVE","simulated":true},
 {"id":"acc-billetera","type":"WALLET","name":"Billetera Demo","maskedNumber":"****7730","currency":"COP","balance":"4600000.00","available":"4600000.00","status":"ACTIVE","simulated":true},
 {"id":"acc-tarjeta","type":"CREDIT_CARD","name":"Tarjeta Demo","maskedNumber":"4111 **** **** 1234","currency":"COP","balance":"-500000.00","balanceMinor":-50000000,"available":"4500000.00","availableMinor":450000000,"creditLimit":"5000000.00","creditLimitMinor":500000000,"paymentDueDate":5,"status":"ACTIVE","simulated":true},
 {"id":"acc-cdt","type":"CDT","name":"CDT Demo","maskedNumber":"****0001","currency":"COP","balance":"2000000.00","balanceMinor":200000000,"available":"2000000.00","status":"ACTIVE","simulated":true,
  "cdt":{"rateEa":10.5,"rateEaBps":1050,"termDays":180,"opened":"2026-08-28","maturity":"2027-02-24"}},
 {"id":"acc-otro","type":"MORTGAGE","name":"Hipoteca","maskedNumber":"****9999","currency":"COP","balance":"1.00","available":"1.00","status":"ACTIVE","simulated":true}
]}`

type signer struct{ audiences []string }

func (s *signer) ClientAssertion(_ context.Context, audience string) (string, error) {
	s.audiences = append(s.audiences, audience)
	return "signed.jwt.assertion", nil
}

// Today in Bogotá is 27 Oct 2026, so the card's day 5 is 5 Nov 2026.
var now = time.Date(2026, 10, 28, 3, 0, 0, 0, time.UTC)

func newAdapter(t *testing.T, provider string) (*Adapter, *fakeBank, *signer) {
	t.Helper()
	fb := &fakeBank{forms: map[string]url.Values{}, auth: map[string]string{}, accounts: allAccounts}
	srv := httptest.NewServer(fb.handler())
	t.Cleanup(srv.Close)
	sg := &signer{}
	a, err := New(Config{
		Provider:     provider,
		BaseURL:      srv.URL,
		ClientID:     "fynk",
		Audience:     "https://auth.fynk.local/realms/banco-demo",
		AuthorizeURL: "https://auth.fynk.local/realms/banco-demo/protocol/openid-connect/auth",
		RedirectURI:  "fynk://bank/callback",
		Signer:       sg,
		HTTP:         srv.Client(),
		Clock:        clock.NewFixed(now),
	})
	if err != nil {
		t.Fatal(err)
	}
	return a, fb, sg
}

func TestNewAcceptsOnlyTheTwoSimulatedProviders(t *testing.T) {
	if _, err := New(Config{Provider: "bancolombia"}); err == nil {
		t.Fatal("bancolombia is not served by Banco Demo")
	}
}

// HU-009 and reference numbers: Banco Demo shows savings, card and CDT; Billetera Demo the wallet.
func TestBancoDemoMapsItsAccountsToTheSharedShape(t *testing.T) {
	a, fb, _ := newAdapter(t, "banco-demo")
	got, err := a.Accounts(context.Background(), "at-1")
	if err != nil {
		t.Fatal(err)
	}
	if fb.auth["/open-finance/v1/accounts"] != "Bearer at-1" {
		t.Fatalf("authorization %q", fb.auth["/open-finance/v1/accounts"])
	}
	if len(got) != 3 {
		t.Fatalf("got %d accounts, want savings, card and cdt: %+v", len(got), got)
	}
	savings, card, cdt := got[0], got[1], got[2]
	if savings.Kind != ports.AccountSavings || savings.DisplayName != "Banco Demo · Ahorros" || savings.Last4 != "4821" ||
		savings.BalanceMinor != 320000000 || *savings.AvailableMinor != 320000000 || !savings.IsSimulated || savings.Currency != "COP" {
		t.Errorf("savings %+v", savings)
	}
	if card.Kind != ports.AccountCreditCard || card.BalanceMinor != 50000000 || *card.CreditLimitMinor != 500000000 ||
		*card.AvailableMinor != 450000000 || card.Last4 != "1234" || card.PaymentDueOn.Format("2006-01-02") != "2026-11-05" {
		t.Errorf("card (owed must be positive) %+v due %v", card, card.PaymentDueOn)
	}
	if cdt.Kind != ports.AccountCDT || cdt.CDT == nil || cdt.CDT.RateEaBps != 1050 || cdt.CDT.TermDays != 180 ||
		cdt.CDT.OpenedOn.Format("2006-01-02") != "2026-08-28" || cdt.CDT.MaturesOn.Format("2006-01-02") != "2027-02-24" {
		t.Errorf("cdt %+v", cdt)
	}
}

func TestBilleteraDemoKeepsOnlyTheWallet(t *testing.T) {
	a, _, _ := newAdapter(t, "billetera-demo")
	got, err := a.Accounts(context.Background(), "at-1")
	if err != nil || len(got) != 1 {
		t.Fatalf("got %+v, %v", got, err)
	}
	w := got[0]
	// No balanceMinor in the answer: the decimal string is converted exactly.
	if w.Kind != ports.AccountWallet || w.DisplayName != "Billetera Demo" || w.BalanceMinor != 460000000 || w.Last4 != "7730" {
		t.Fatalf("wallet %+v", w)
	}
}

// Security rules: only the last 4 digits leave the adapter.
func TestOnlyTheLastFourDigitsLeaveTheAdapter(t *testing.T) {
	a, _, _ := newAdapter(t, "banco-demo")
	got, _ := a.Accounts(context.Background(), "at-1")
	b, _ := json.Marshal(got)
	for _, leak := range []string{"****", "4111", "maskedNumber"} {
		if strings.Contains(string(b), leak) {
			t.Fatalf("%q left the adapter: %s", leak, b)
		}
	}
}

func TestTransactionsMapAndPageWithTheCursor(t *testing.T) {
	a, fb, _ := newAdapter(t, "banco-demo")
	since := time.Date(2025, 10, 28, 0, 0, 0, 0, time.UTC)
	page, err := a.Transactions(context.Background(), "at-1", "acc-ahorros", since, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 2 || page.NextCursor != "page-2" {
		t.Fatalf("page %+v", page)
	}
	salary, pending := page.Items[0], page.Items[1]
	if salary.ProviderTxID != "tx-2" || salary.AmountMinor != 520000000 || salary.Status != ports.TxBooked ||
		salary.MerchantRaw != "EMPRESA DEMO SAS" || salary.BankCategory != "salary" || !salary.BookedAt.Equal(time.Date(2026, 10, 30, 8, 0, 0, 0, time.UTC)) {
		t.Errorf("salary %+v", salary)
	}
	if pending.AmountMinor != -1843000 || pending.Status != ports.TxPending || pending.MerchantRaw != "" {
		t.Errorf("pending %+v", pending)
	}
	q := fb.queries[0]
	if q.Get("fromBookingDate") != "2025-10-28T00:00:00Z" || q.Get("pageSize") != "200" || q.Get("cursor") != "" {
		t.Errorf("query %v", q)
	}
	last, err := a.Transactions(context.Background(), "at-1", "acc-ahorros", since, "page-2")
	if err != nil || len(last.Items) != 0 || last.NextCursor != "" || fb.queries[1].Get("cursor") != "page-2" {
		t.Fatalf("last page %+v, %v, %v", last, err, fb.queries[1])
	}
}

// HU-008 and M4: a revoked consent at the bank is consent_revoked, so the sync stops.
func TestBankErrorsBecomeStableCodesWithoutTheBanksText(t *testing.T) {
	cases := []struct {
		status         int
		problem, retry string
		want           error
		wantRetryAfter time.Duration
	}{
		{http.StatusForbidden, "consent_revoked", "", ports.ErrConsentRevoked, 0},
		{http.StatusUnauthorized, "unauthorized", "", ports.ErrInvalidGrant, 0},
		{http.StatusTooManyRequests, "rate_limit_exceeded", "17", nil, 17 * time.Second},
		{http.StatusInternalServerError, "internal_error", "", ports.ErrProviderUnavailable, 0},
	}
	for _, tc := range cases {
		a, fb, _ := newAdapter(t, "banco-demo")
		fb.status, fb.problem, fb.retry = tc.status, tc.problem, tc.retry
		_, err := a.Accounts(context.Background(), "at-1")
		if tc.want != nil && !errors.Is(err, tc.want) {
			t.Errorf("%d: err = %v, want %v", tc.status, err, tc.want)
		}
		if tc.wantRetryAfter > 0 {
			var limited *ports.RateLimitedError
			if !errors.As(err, &limited) || limited.RetryAfter != tc.wantRetryAfter {
				t.Errorf("429: err = %v", err)
			}
		}
		if err != nil && strings.Contains(err.Error(), "secret-detail-from-bank") {
			t.Errorf("%d: the bank's text leaked into the error: %v", tc.status, err)
		}
		_, terr := a.Transactions(context.Background(), "at-1", "acc-1", now, "")
		if tc.want != nil && !errors.Is(terr, tc.want) {
			t.Errorf("%d transactions: err = %v", tc.status, terr)
		}
	}
}

// HU-030: PAR with PKCE and private_key_jwt, never the user's credentials.
func TestPushAuthorizationSendsPARWithPKCEAndAClientAssertion(t *testing.T) {
	a, fb, sg := newAdapter(t, "banco-demo")
	res, err := a.PushAuthorization(context.Background(), ports.PARRequest{
		RedirectURI: "fynk://bank/callback", CodeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
		State: "state-1", Nonce: "nonce-1", ConsentID: "0192f0a0-0000-7000-8000-000000000001",
		Scopes: []ports.Scope{ports.ScopeBalances, ports.ScopeTransactions, ports.ScopeAccountDetails},
	})
	if err != nil {
		t.Fatal(err)
	}
	f := fb.forms["/oauth/par"]
	want := map[string]string{
		"client_id": "fynk", "redirect_uri": "fynk://bank/callback", "response_type": "code",
		"code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM", "code_challenge_method": "S256",
		"state": "state-1", "nonce": "nonce-1", "scope": "accounts transactions",
		"client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
		"client_assertion":      "signed.jwt.assertion", "fynk_consent_id": "0192f0a0-0000-7000-8000-000000000001",
	}
	for k, v := range want {
		if f.Get(k) != v {
			t.Errorf("PAR %s = %q, want %q", k, f.Get(k), v)
		}
	}
	if len(sg.audiences) != 1 || sg.audiences[0] != "https://auth.fynk.local/realms/banco-demo" {
		t.Errorf("assertion audiences %v", sg.audiences)
	}
	u, _ := url.Parse(res.AuthorizeURL)
	if u.Host != "auth.fynk.local" || u.Query().Get("client_id") != "fynk" ||
		u.Query().Get("request_uri") != "urn:ietf:params:oauth:request_uri:par-1" || len(u.Query()) != 2 || res.ExpiresIn != 5*time.Minute {
		t.Errorf("authorize %q (only client_id and request_uri may travel in the URL), expires %v", res.AuthorizeURL, res.ExpiresIn)
	}
}

func TestExchangeAndRefreshReturnTheBanksConsentID(t *testing.T) {
	a, fb, _ := newAdapter(t, "banco-demo")
	ts, err := a.ExchangeCode(context.Background(), ports.CodeExchange{Code: "code-1", CodeVerifier: "verifier-1", RedirectURI: "fynk://bank/callback"})
	if err != nil || ts.AccessToken != "at-1" || ts.RefreshToken != "rt-1" || ts.ExpiresIn != 5*time.Minute || ts.ProviderConsentID != "consent-abc" {
		t.Fatalf("exchange %+v, %v", ts, err)
	}
	f := fb.forms["/oauth/token"]
	if f.Get("grant_type") != "authorization_code" || f.Get("code_verifier") != "verifier-1" || f.Get("client_assertion") == "" {
		t.Errorf("token form %v", f)
	}
	if _, err := a.ExchangeCode(context.Background(), ports.CodeExchange{Code: "bad", CodeVerifier: "v"}); !errors.Is(err, ports.ErrInvalidGrant) {
		t.Errorf("bad code: err = %v", err)
	}
	ts, err = a.Refresh(context.Background(), "rt-1")
	if err != nil || ts.AccessToken != "at-2" || ts.RefreshToken != "rt-2" || fb.forms["/oauth/token"].Get("refresh_token") != "rt-1" {
		t.Fatalf("refresh %+v, %v", ts, err)
	}
}

// HU-008: revocation reaches the bank with a client credentials token, no user token.
func TestRevokeConsentUsesClientCredentials(t *testing.T) {
	a, fb, _ := newAdapter(t, "banco-demo")
	if err := a.RevokeConsent(context.Background(), "consent-abc"); err != nil {
		t.Fatal(err)
	}
	if fb.forms["/oauth/token"].Get("grant_type") != "client_credentials" ||
		fb.auth["/open-finance/v1/consents/consent-abc"] != "Bearer cc-1" || fb.revoked[0] != "consent-abc" {
		t.Fatalf("forms %v auth %v revoked %v", fb.forms, fb.auth, fb.revoked)
	}
	// Already unknown at the bank: nothing is left to revoke, so M4's retry job can stop.
	if err := a.RevokeConsent(context.Background(), "gone"); err != nil {
		t.Fatalf("gone: %v", err)
	}
}

func TestProductsArePublic(t *testing.T) {
	a, fb, _ := newAdapter(t, "banco-demo")
	got, err := a.Products(context.Background())
	if err != nil || len(got) != 1 {
		t.Fatalf("products %+v, %v", got, err)
	}
	p := got[0]
	if p.ID != "cdt-demo-180" || p.TermDays != 180 || p.RateEaBps != 1050 || p.MinAmountMinor != 50000000 || p.Risk != "low" {
		t.Errorf("product %+v", p)
	}
	if fb.auth["/open-finance/v1/products/cdt"] != "" {
		t.Error("the public catalog must not carry a token")
	}
}

func TestDecimalAmountsConvertExactly(t *testing.T) {
	for in, want := range map[string]int64{
		"3200000.00": 320000000, "+5200000.00": 520000000, "-500000.00": -50000000,
		"12480350.5": 1248035050, "0.07": 7, "1": 100,
	} {
		if got, err := parseMinor(in); err != nil || got != want {
			t.Errorf("parseMinor(%q) = %d, %v, want %d", in, got, err, want)
		}
	}
	for _, bad := range []string{"", "1.234", "1,5", "abc", "1e5", "--1"} {
		if _, err := parseMinor(bad); err == nil {
			t.Errorf("parseMinor(%q) accepted", bad)
		}
	}
}
