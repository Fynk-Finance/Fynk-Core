package main

import (
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
)

// The portal (HU-048) logs the person in at the banco-demo realm, like the
// authorization page, and shows that person's products: never the seeded demo
// customer and never a customer named in the URL.

const portalSub = "7c9e6679-7425-40de-944b-e07fc1f90ae7"

// portalLogin opens path without a session, runs the realm login and checks it
// comes back to path. It returns the session cookie the callback set.
func (e *authzEnv) portalLogin(c *http.Client, path string, claims map[string]any) *http.Cookie {
	e.t.Helper()
	resp, _ := get(e.t, c, e.srv.URL+path)
	loc, err := url.Parse(resp.Header.Get("Location"))
	if resp.StatusCode != http.StatusFound || err != nil || !strings.HasPrefix(loc.String(), authzIssuer+"/protocol/openid-connect/auth?") {
		e.t.Fatalf("expected a redirect to the realm, got %d %s", resp.StatusCode, resp.Header.Get("Location"))
	}
	q := loc.Query()
	if q.Get("redirect_uri") != "http://localhost:8082/oauth/authorize/callback" || q.Get("code_challenge_method") != "S256" {
		e.t.Fatalf("bad auth request: %v", q)
	}
	e.realm.token = e.realm.idToken(q.Get("nonce"), claims)
	cb, _ := get(e.t, c, e.srv.URL+"/oauth/authorize/callback?"+url.Values{"code": {"realm-code"}, "state": {q.Get("state")}}.Encode())
	if cb.StatusCode != http.StatusSeeOther || cb.Header.Get("Location") != path {
		e.t.Fatalf("callback answered %d %s, want a return to %s", cb.StatusCode, cb.Header.Get("Location"), path)
	}
	for _, ck := range cb.Cookies() {
		if ck.Name == "bank_session" {
			return ck
		}
	}
	e.t.Fatal("callback set no session cookie")
	return nil
}

func TestPortal_AsksForLoginAndShowsTheFynkUser(t *testing.T) {
	e := newAuthzEnv(t, true)
	c := e.browser()
	sess := e.portalLogin(c, "/portal/actions", map[string]any{"fynk_sub": portalSub})
	if sess.Path != "/" || !sess.HttpOnly || sess.SameSite != http.SameSiteLaxMode {
		t.Errorf("session cookie = %+v, want path / so the portal receives it", sess)
	}

	resp, body := get(t, c, e.srv.URL+"/portal/actions")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("portal answered %d after login", resp.StatusCode)
	}
	if !strings.Contains(body, portalSub) || strings.Contains(body, domain.DemoCustomerID) {
		t.Error("the portal does not show the logged in Fynk user")
	}
}

func TestPortal_IgnoresTheUserQueryOnceLoginIsOn(t *testing.T) {
	e := newAuthzEnv(t, true)
	c := e.browser()
	e.portalLogin(c, "/portal", map[string]any{"fynk_sub": portalSub})

	_, body := get(t, c, e.srv.URL+"/portal?user="+url.QueryEscape(domain.DemoCustomerID))
	if strings.Contains(body, domain.DemoCustomerID) || !strings.Contains(body, portalSub) {
		t.Error("?user= picked the customer although the realm login is configured")
	}
	// Without a session the query does not open anyone's portal either.
	if resp, _ := get(t, e.browser(), e.srv.URL+"/portal?user="+portalSub); resp.StatusCode != http.StatusFound {
		t.Errorf("no session: got %d, want a redirect to the login", resp.StatusCode)
	}
}

func TestPortal_LoginReturnStaysInsideThePortal(t *testing.T) {
	e := newAuthzEnv(t, true)
	c := e.browser()
	// A post without a session goes to the login and comes back to the portal home.
	resp, err := c.PostForm(e.srv.URL+"/portal/actions/pay", url.Values{"amount": {"1000"}})
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusFound || !strings.HasPrefix(resp.Header.Get("Location"), authzIssuer) {
		t.Fatalf("post without session: got %d %s", resp.StatusCode, resp.Header.Get("Location"))
	}
	loc, _ := url.Parse(resp.Header.Get("Location"))
	e.realm.token = e.realm.idToken(loc.Query().Get("nonce"), map[string]any{"fynk_sub": portalSub})
	cb, _ := get(t, c, e.srv.URL+"/oauth/authorize/callback?"+url.Values{"code": {"c"}, "state": {loc.Query().Get("state")}}.Encode())
	if cb.Header.Get("Location") != "/portal" {
		t.Errorf("post login return = %q, want /portal", cb.Header.Get("Location"))
	}
}

func TestPortal_ActionsActOnTheLoggedInCustomerWithCSRF(t *testing.T) {
	e := newAuthzEnv(t, true)
	c := e.browser()
	e.portalLogin(c, "/portal/actions", map[string]any{"fynk_sub": portalSub})
	_, body := get(t, c, e.srv.URL+"/portal/actions")
	m := csrfField.FindStringSubmatch(body)
	if m == nil {
		t.Fatal("the actions page has no CSRF field")
	}
	accounts := e.store.GetCustomer(portalSub).Accounts
	if len(accounts) == 0 {
		t.Fatal("test customer has no accounts")
	}
	form := url.Values{
		"account_id": {accounts[0].ID}, "merchant": {"TIENDA PORTAL DEMO"},
		"category": {"shopping"}, "amount": {"1000"},
	}

	resp, err := c.PostForm(e.srv.URL+"/portal/actions/pay", form)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Errorf("post without csrf: got %d, want 403", resp.StatusCode)
	}

	form.Set("csrf", m[1])
	resp, err = c.PostForm(e.srv.URL+"/portal/actions/pay", form)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if resp.StatusCode != http.StatusSeeOther || strings.Contains(resp.Header.Get("Location"), "error=") {
		t.Fatalf("payment: got %d %s", resp.StatusCode, resp.Header.Get("Location"))
	}
	if !hasMerchant(e.store.GetCustomer(portalSub).Transactions, "TIENDA PORTAL DEMO") {
		t.Error("the payment is not in the logged in customer's movements")
	}
	if hasMerchant(e.store.GetCustomer(domain.DemoCustomerID).Transactions, "TIENDA PORTAL DEMO") {
		t.Error("the payment went to the seeded demo customer")
	}
}

func TestPortal_RevokesOnlyTheCustomersOwnConsents(t *testing.T) {
	e := newAuthzEnv(t, true)
	other := e.store.CreateConsent("consent-other", domain.DemoCustomerID, "fynk", []string{"accounts"}, "test", 30)
	c := e.browser()
	e.portalLogin(c, "/portal/consents", map[string]any{"fynk_sub": portalSub})
	_, body := get(t, c, e.srv.URL+"/portal/consents")
	if strings.Contains(body, other.ID) {
		t.Error("another customer's consent is listed")
	}
	m := csrfField.FindStringSubmatch(body)
	csrf := ""
	if m != nil {
		csrf = m[1]
	} else {
		// No consent of their own yet, so no form: take the token from the actions page.
		_, actions := get(t, c, e.srv.URL+"/portal/actions")
		csrf = csrfField.FindStringSubmatch(actions)[1]
	}
	resp, err := c.PostForm(e.srv.URL+"/portal/consents/revoke", url.Values{"consent_id": {other.ID}, "csrf": {csrf}})
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	if got, _ := e.store.GetConsent(other.ID); got.Status != domain.ConsentStatusActive {
		t.Errorf("another customer's consent was revoked (status %s)", got.Status)
	}
}

func TestPortal_WithoutRealmKeepsTheLocalFallback(t *testing.T) {
	e := newAuthzEnv(t, false)
	resp, body := get(t, e.browser(), e.srv.URL+"/portal")
	if resp.StatusCode != http.StatusOK || !strings.Contains(body, domain.DemoCustomerID) {
		t.Errorf("no realm configured: got %d, want the demo customer page", resp.StatusCode)
	}
}

func hasMerchant(txs []domain.Transaction, merchant string) bool {
	for _, tx := range txs {
		if tx.MerchantName != nil && *tx.MerchantName == merchant {
			return true
		}
	}
	return false
}
