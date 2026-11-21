package main

import (
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
)

// A Fynk user's realm login on a shared phone (Android Custom Tabs keep cookies)
// can belong to someone else. These tests cover how the simulator signs that
// person out of the realm before the right one logs in.

// realmRedirect opens the authorization page and returns the query of the realm
// login it redirects to. It fails when any other page is shown instead.
func (e *authzEnv) realmRedirect(c *http.Client, requestURI string) url.Values {
	e.t.Helper()
	resp, _ := get(e.t, c, e.authorizeURL(requestURI))
	loc, err := url.Parse(resp.Header.Get("Location"))
	if resp.StatusCode != http.StatusFound || err != nil || !strings.HasPrefix(loc.String(), authzIssuer+"/protocol/openid-connect/auth?") {
		e.t.Fatalf("expected a redirect to the realm login, got %d %q", resp.StatusCode, resp.Header.Get("Location"))
	}
	if loc.Query().Has("prompt") {
		e.t.Fatalf("the realm login must not send prompt (Keycloak would keep the old user)")
	}
	return loc.Query()
}

// callbackWith answers the realm login with the given ID token and returns the response.
func (e *authzEnv) callbackWith(c *http.Client, q url.Values, token string) (*http.Response, string) {
	e.t.Helper()
	e.realm.token = token
	return get(e.t, c, e.srv.URL+"/oauth/authorize/callback?"+url.Values{"code": {"realm-code"}, "state": {q.Get("state")}}.Encode())
}

// otherCustomerWith is a customer with products at the entity who is not `not`.
func (e *authzEnv) otherCustomerWith(entity, not string) string {
	e.t.Helper()
	for i := 0; i < 2000; i++ {
		id := fmt.Sprintf("sub-%04d", i)
		for _, s := range domain.EntitySummaries(e.store.GetCustomer(id)) {
			if s.ProviderID == entity && id != not {
				return id
			}
		}
	}
	e.t.Fatalf("no second customer at %s", entity)
	return ""
}

type signOutForm struct {
	action, idTokenHint, returnTo string
}

var (
	formAction  = regexp.MustCompile(`<form id="realm-logout" method="post" action="([^"]+)"`)
	hiddenField = func(name string) *regexp.Regexp {
		return regexp.MustCompile(`name="` + name + `" value="([^"]+)"`)
	}
)

// signOutPage checks that a response is the page that signs the realm user out
// with a POST (the ID token never goes in a URL) and returns its form.
func (e *authzEnv) signOutPage(resp *http.Response, body string) signOutForm {
	e.t.Helper()
	if resp.StatusCode != http.StatusOK || strings.Contains(body, ">Autorizar<") {
		e.t.Fatalf("expected the sign out page, got %d", resp.StatusCode)
	}
	pick := func(re *regexp.Regexp) string {
		m := re.FindStringSubmatch(body)
		if m == nil {
			e.t.Fatalf("sign out page lacks %s", re)
		}
		return strings.ReplaceAll(m[1], "&amp;", "&")
	}
	f := signOutForm{
		action:      pick(formAction),
		idTokenHint: pick(hiddenField("id_token_hint")),
		returnTo:    pick(hiddenField("post_logout_redirect_uri")),
	}
	if f.action != authzIssuer+"/protocol/openid-connect/logout" {
		e.t.Fatalf("logout action = %q", f.action)
	}
	if loc := resp.Header.Get("Location"); loc != "" {
		e.t.Fatalf("the sign out page must not redirect, got %q", loc)
	}
	return f
}

func (e *authzEnv) wantReturnTo(f signOutForm, requestURI string) {
	e.t.Helper()
	want := "http://localhost:8082/oauth/authorize?" + url.Values{"client_id": {"fynk"}, "request_uri": {requestURI}}.Encode()
	if f.returnTo != want {
		e.t.Fatalf("post_logout_redirect_uri = %q, want %q", f.returnTo, want)
	}
}

func TestAuthorize_SessionOfAnotherFynkUserSignsThemOutOfTheRealm(t *testing.T) {
	e := newAuthzEnv(t, true)
	a := e.customerWith(domain.ProviderBancoDemo, "")
	c := e.browser()
	first, _ := e.parFor(domain.ProviderBancoDemo, a)
	q := e.realmRedirect(c, first)
	tokenA := e.realm.idToken(q.Get("nonce"), map[string]any{"fynk_sub": a})
	if cb, _ := e.callbackWith(c, q, tokenA); cb.StatusCode != http.StatusSeeOther {
		t.Fatalf("A's login answered %d", cb.StatusCode)
	}

	second, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-b")
	resp, body := get(t, c, e.authorizeURL(second))
	f := e.signOutPage(resp, body)
	if f.idTokenHint != tokenA {
		t.Fatal("the realm logout must carry A's own ID token")
	}
	e.wantReturnTo(f, second)
	// A's session is gone here too: A's own request now asks for a login.
	e.realmRedirect(c, first)
}

func TestAuthorize_AfterTheRealmLogoutTheRightUserReachesConsent(t *testing.T) {
	e := newAuthzEnv(t, true)
	a := e.customerWith(domain.ProviderBancoDemo, "")
	b := e.otherCustomerWith(domain.ProviderBancoDemo, a)
	c := e.browser()
	first, _ := e.parFor(domain.ProviderBancoDemo, a)
	e.login(c, first, map[string]any{"fynk_sub": a})

	second, _ := e.parFor(domain.ProviderBancoDemo, b)
	e.signOutPage(get(t, c, e.authorizeURL(second)))
	// The realm comes back to the authorization page; now B logs in.
	q := e.realmRedirect(c, second)
	if cb, _ := e.callbackWith(c, q, e.realm.idToken(q.Get("nonce"), map[string]any{"fynk_sub": b})); cb.StatusCode != http.StatusSeeOther {
		t.Fatalf("B's login answered %d", cb.StatusCode)
	}
	if resp, body := get(t, c, e.authorizeURL(second)); resp.StatusCode != http.StatusOK || !strings.Contains(body, ">Autorizar<") {
		t.Fatalf("expected B's consent page, got %d", resp.StatusCode)
	}
}

func TestAuthorize_RealmSSOOfAnotherFynkUserIsSignedOutAtTheCallback(t *testing.T) {
	e := newAuthzEnv(t, true)
	a := e.customerWith(domain.ProviderBancoDemo, "")
	c := e.browser()
	// No simulator session, but the realm still knows A and answers with A at once.
	req, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-b")
	q := e.realmRedirect(c, req)
	tokenA := e.realm.idToken(q.Get("nonce"), map[string]any{"fynk_sub": a})
	f := e.signOutPage(e.callbackWith(c, q, tokenA))
	if f.idTokenHint != tokenA {
		t.Fatal("the realm logout must carry the ID token the realm just gave")
	}
	e.wantReturnTo(f, req)
	// No session was kept for A.
	e.realmRedirect(c, req)
}

func TestAuthorize_SecondWrongUserForTheSameRequestIsRefused(t *testing.T) {
	e := newAuthzEnv(t, true)
	a := e.customerWith(domain.ProviderBancoDemo, "")
	c := e.browser()
	req, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-b")
	q := e.realmRedirect(c, req)
	e.signOutPage(e.callbackWith(c, q, e.realm.idToken(q.Get("nonce"), map[string]any{"fynk_sub": a})))

	// The logout did not reach the Fynk realm and A comes back again: no loop, a 403.
	q = e.realmRedirect(c, req)
	cb, body := e.callbackWith(c, q, e.realm.idToken(q.Get("nonce"), map[string]any{"fynk_sub": a}))
	if cb.StatusCode != http.StatusForbidden || strings.Contains(body, ">Autorizar<") {
		t.Fatalf("expected 403 without consent, got %d", cb.StatusCode)
	}
	e.realmRedirect(c, req)
}

func TestAuthorize_DemoCustomerIsAcceptedForThatRequestOnly(t *testing.T) {
	e := newAuthzEnv(t, true)
	c := e.browser()
	req, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-b")
	q := e.realmRedirect(c, req)
	demoToken := e.realm.idToken(q.Get("nonce"), map[string]any{"sub": "realm-uuid-1", "preferred_username": domain.DemoCustomerID})
	if cb, _ := e.callbackWith(c, q, demoToken); cb.StatusCode != http.StatusSeeOther {
		t.Fatalf("the demo customer's login answered %d", cb.StatusCode)
	}
	if resp, body := get(t, c, e.authorizeURL(req)); resp.StatusCode != http.StatusOK || !strings.Contains(body, ">Autorizar<") {
		t.Fatalf("expected the consent page for the demo customer, got %d", resp.StatusCode)
	}
	// Another Fynk user's request signs the demo customer out first.
	other, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-c")
	if f := e.signOutPage(get(t, c, e.authorizeURL(other))); f.idTokenHint != demoToken {
		t.Fatal("the realm logout must carry the demo customer's ID token")
	}
}

func TestAuthorize_SessionMatchingTheFynkUserOrNoFynkUserShowsConsent(t *testing.T) {
	e := newAuthzEnv(t, true)
	a := e.customerWith(domain.ProviderBancoDemo, "")
	c := e.browser()
	first, _ := e.parFor(domain.ProviderBancoDemo, a)
	e.login(c, first, map[string]any{"fynk_sub": a})
	matching, _ := e.parFor(domain.ProviderBancoDemo, a)
	noSub, _ := e.par(domain.ProviderBancoDemo)
	for name, req := range map[string]string{"matching": matching, "no sub": noSub} {
		if resp, body := get(t, c, e.authorizeURL(req)); resp.StatusCode != http.StatusOK || !strings.Contains(body, ">Autorizar<") {
			t.Fatalf("%s: expected the consent page, got %d", name, resp.StatusCode)
		}
	}
}

func TestAuthorize_SignOutNeverLogsTheIDToken(t *testing.T) {
	e := newAuthzEnv(t, true)
	a := e.customerWith(domain.ProviderBancoDemo, "")
	c := e.browser()
	req, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-b")
	q := e.realmRedirect(c, req)
	tokenA := e.realm.idToken(q.Get("nonce"), map[string]any{"fynk_sub": a})
	e.signOutPage(e.callbackWith(c, q, tokenA))
	q = e.realmRedirect(c, req)
	e.callbackWith(c, q, e.realm.idToken(q.Get("nonce"), map[string]any{"fynk_sub": a}))
	if e.logs.Len() == 0 {
		t.Fatal("expected a log line, so the capture is proven to work")
	}
	for _, secret := range []string{tokenA, a, "fynk-user-b"} {
		if strings.Contains(e.logs.String(), secret) {
			t.Errorf("a secret appeared in the logs: %s", e.logs.String())
		}
	}
}
