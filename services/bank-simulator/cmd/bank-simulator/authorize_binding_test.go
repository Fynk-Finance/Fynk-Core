package main

import (
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
)

// realmRedirect opens the authorization page and returns the query of the realm
// login it redirects to. It fails when the consent page is shown instead.
func (e *authzEnv) realmRedirect(c *http.Client, requestURI string) url.Values {
	e.t.Helper()
	resp, body := get(e.t, c, e.authorizeURL(requestURI))
	if resp.StatusCode != http.StatusFound || strings.Contains(body, ">Autorizar<") {
		e.t.Fatalf("expected a redirect to the realm login, got %d", resp.StatusCode)
	}
	loc, err := url.Parse(resp.Header.Get("Location"))
	if err != nil || !strings.HasPrefix(loc.String(), authzIssuer+"/protocol/openid-connect/auth?") {
		e.t.Fatalf("bad realm redirect %q", resp.Header.Get("Location"))
	}
	return loc.Query()
}

// callback answers the realm login with the given ID token claims.
func (e *authzEnv) callback(c *http.Client, q url.Values, claims map[string]any) {
	e.t.Helper()
	e.realm.token = e.realm.idToken(q.Get("nonce"), claims)
	cb, _ := get(e.t, c, e.srv.URL+"/oauth/authorize/callback?"+url.Values{"code": {"realm-code"}, "state": {q.Get("state")}}.Encode())
	if cb.StatusCode != http.StatusSeeOther {
		e.t.Fatalf("callback answered %d", cb.StatusCode)
	}
}

func TestAuthorize_SessionOfAnotherFynkUserForcesAFreshLogin(t *testing.T) {
	e := newAuthzEnv(t, true)
	a := e.customerWith(domain.ProviderBancoDemo, "")
	c := e.browser()
	first, _ := e.parFor(domain.ProviderBancoDemo, a)
	e.login(c, first, map[string]any{"fynk_sub": a})

	second, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-b")
	if q := e.realmRedirect(c, second); q.Get("prompt") != "login" {
		t.Fatalf("prompt = %q, want login", q.Get("prompt"))
	}
	// A's session is gone: the first request no longer reaches the consent page.
	e.realmRedirect(c, first)
}

func TestAuthorize_ForcedLoginEndsInConsentWithoutLooping(t *testing.T) {
	e := newAuthzEnv(t, true)
	a := e.customerWith(domain.ProviderBancoDemo, "")
	c := e.browser()
	first, _ := e.parFor(domain.ProviderBancoDemo, a)
	e.login(c, first, map[string]any{"fynk_sub": a})

	second, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-b")
	q := e.realmRedirect(c, second)
	// The fresh login yields the seeded demo customer, which is not the Fynk user.
	e.callback(c, q, map[string]any{"sub": "realm-uuid-1", "preferred_username": domain.DemoCustomerID})
	resp, body := get(t, c, e.authorizeURL(second))
	if resp.StatusCode != http.StatusOK || !strings.Contains(body, ">Autorizar<") {
		t.Fatalf("expected the consent page after the forced login, got %d", resp.StatusCode)
	}
	// The exemption belongs to that request only.
	third, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-c")
	if q := e.realmRedirect(c, third); q.Get("prompt") != "login" {
		t.Fatalf("a new request must force a login again")
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

func TestAuthorize_NormalLoginIsNotForced(t *testing.T) {
	e := newAuthzEnv(t, true)
	req, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-b")
	if q := e.realmRedirect(e.browser(), req); q.Has("prompt") {
		t.Fatalf("no session: login must not force prompt, got %q", q.Get("prompt"))
	}
}

func TestAuthorize_ForcedLoginAsAnotherFynkUserIsRefused(t *testing.T) {
	e := newAuthzEnv(t, true)
	a := e.customerWith(domain.ProviderBancoDemo, "")
	c := e.browser()
	first, _ := e.parFor(domain.ProviderBancoDemo, a)
	e.login(c, first, map[string]any{"fynk_sub": a})

	second, _ := e.parFor(domain.ProviderBancoDemo, "fynk-user-b")
	q := e.realmRedirect(c, second)
	// The realm still answers with A (a stale Fynk session in the browser).
	e.realm.token = e.realm.idToken(q.Get("nonce"), map[string]any{"fynk_sub": a})
	cb, body := get(t, c, e.srv.URL+"/oauth/authorize/callback?"+url.Values{"code": {"realm-code"}, "state": {q.Get("state")}}.Encode())
	if cb.StatusCode != http.StatusForbidden || strings.Contains(body, ">Autorizar<") {
		t.Fatalf("expected 403 without consent, got %d", cb.StatusCode)
	}
	// No session was kept for A: the request still asks for a login.
	e.realmRedirect(c, second)
}
