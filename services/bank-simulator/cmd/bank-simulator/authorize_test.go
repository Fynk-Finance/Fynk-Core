package main

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/authorize"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

const (
	authzIssuer   = "http://keycloak.test/realms/banco-demo"
	authzVerifier = "verifier-verifier-verifier-verifier-verifier"
	redirectURI   = "fynk://bank/callback"
)

// fakeRealm is the banco-demo realm: JWKS, token endpoint and a signer.
type fakeRealm struct {
	t     *testing.T
	key   *rsa.PrivateKey
	srv   *httptest.Server
	token string
}

func newFakeRealm(t *testing.T) *fakeRealm {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeRealm{t: t, key: key}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /protocol/openid-connect/certs", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": "k1", "kty": "RSA", "use": "sig",
			"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	})
	mux.HandleFunc("POST /protocol/openid-connect/token", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"id_token": f.token})
	})
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeRealm) idToken(nonce string, extra map[string]any) string {
	claims := map[string]any{
		"iss": authzIssuer, "aud": "bank-portal", "azp": "bank-portal", "nonce": nonce,
		"exp": time.Now().Add(time.Hour).Unix(), "sub": "bank-sub-1",
	}
	for k, v := range extra {
		claims[k] = v
	}
	enc := func(v any) string { b, _ := json.Marshal(v); return base64.RawURLEncoding.EncodeToString(b) }
	signing := enc(map[string]string{"alg": "PS256", "kid": "k1"}) + "." + enc(claims)
	digest := sha256.Sum256([]byte(signing))
	sig, err := rsa.SignPSS(rand.Reader, f.key, crypto.SHA256, digest[:], &rsa.PSSOptions{SaltLength: rsa.PSSSaltLengthEqualsHash})
	if err != nil {
		f.t.Fatal(err)
	}
	return signing + "." + base64.RawURLEncoding.EncodeToString(sig)
}

type authzEnv struct {
	t     *testing.T
	store *store.BankStore
	realm *fakeRealm
	srv   *httptest.Server
	logs  *bytes.Buffer
}

func newAuthzEnv(t *testing.T, configured bool) *authzEnv {
	s := store.NewBankStore(time.Time{})
	realm := newFakeRealm(t)
	logs := &bytes.Buffer{}
	cfg := authorize.Config{Logger: slog.New(slog.NewJSONHandler(logs, nil))}
	if configured {
		cfg.PublicURL = "http://localhost:8082"
		cfg.Issuer, cfg.BackchannelURL = authzIssuer, realm.srv.URL
		cfg.ClientID, cfg.ClientSecret = "bank-portal", "portal-secret-local-only"
	}
	srv := httptest.NewServer(newBankMux(s, "fynk", cfg))
	t.Cleanup(srv.Close)
	return &authzEnv{t: t, store: s, realm: realm, srv: srv, logs: logs}
}

// browser keeps cookies and never follows redirects, so tests see each hop.
func (e *authzEnv) browser() *http.Client {
	jar, _ := cookiejar.New(nil)
	return &http.Client{Jar: jar, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
}

func (e *authzEnv) par(entity string) (requestURI, consentID string) {
	e.t.Helper()
	sum := sha256.Sum256([]byte(authzVerifier))
	form := url.Values{
		"client_id": {"fynk"}, "redirect_uri": {redirectURI}, "scope": {"accounts transactions"},
		"code_challenge": {base64.RawURLEncoding.EncodeToString(sum[:])}, "code_challenge_method": {"S256"},
		"state": {"fynk-state"}, "entity": {entity},
		"client_assertion_type": {jwtBearerType}, "client_assertion": {fakeJWT("fynk")},
	}
	resp, err := http.PostForm(e.srv.URL+"/oauth/par", form)
	if err != nil {
		e.t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var body struct {
		RequestURI string `json:"request_uri"`
		ConsentID  string `json:"consent_id"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&body)
	if resp.StatusCode != http.StatusCreated {
		e.t.Fatalf("PAR answered %d", resp.StatusCode)
	}
	return body.RequestURI, body.ConsentID
}

func (e *authzEnv) authorizeURL(requestURI string) string {
	return e.srv.URL + "/oauth/authorize?" + url.Values{"request_uri": {requestURI}, "client_id": {"fynk"}}.Encode()
}

func get(t *testing.T, c *http.Client, u string) (*http.Response, string) {
	t.Helper()
	resp, err := c.Get(u)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	b, _ := io.ReadAll(resp.Body)
	return resp, string(b)
}

// login runs the realm login for a browser: authorize -> realm -> callback.
func (e *authzEnv) login(c *http.Client, requestURI string, claims map[string]any) {
	e.t.Helper()
	resp, _ := get(e.t, c, e.authorizeURL(requestURI))
	loc, err := url.Parse(resp.Header.Get("Location"))
	if resp.StatusCode != http.StatusFound || err != nil || !strings.HasPrefix(loc.String(), authzIssuer+"/protocol/openid-connect/auth?") {
		e.t.Fatalf("expected a redirect to the realm, got %d %s", resp.StatusCode, resp.Header.Get("Location"))
	}
	q := loc.Query()
	if q.Get("code_challenge_method") != "S256" || q.Get("client_id") != "bank-portal" || q.Get("redirect_uri") != "http://localhost:8082/oauth/authorize/callback" {
		e.t.Fatalf("bad auth request: %v", q)
	}
	e.realm.token = e.realm.idToken(q.Get("nonce"), claims)
	cb, _ := get(e.t, c, e.srv.URL+"/oauth/authorize/callback?"+url.Values{"code": {"realm-code"}, "state": {q.Get("state")}}.Encode())
	if cb.StatusCode != http.StatusSeeOther || !strings.HasPrefix(cb.Header.Get("Location"), "/oauth/authorize?") {
		e.t.Fatalf("callback answered %d %s", cb.StatusCode, cb.Header.Get("Location"))
	}
}

var csrfField = regexp.MustCompile(`name="csrf" value="([^"]+)"`)

func (e *authzEnv) decide(c *http.Client, requestURI, csrf, decision string) *http.Response {
	e.t.Helper()
	resp, err := c.PostForm(e.srv.URL+"/oauth/authorize/decision", url.Values{
		"request_uri": {requestURI}, "client_id": {"fynk"}, "csrf": {csrf}, "decision": {decision},
	})
	if err != nil {
		e.t.Fatal(err)
	}
	_ = resp.Body.Close()
	return resp
}

// customerWith finds a customer id with accounts at have and none at missing.
func (e *authzEnv) customerWith(have, missing string) string {
	e.t.Helper()
	for i := 0; i < 2000; i++ {
		id := fmt.Sprintf("sub-%04d", i)
		has := map[string]bool{}
		for _, s := range domain.EntitySummaries(e.store.GetCustomer(id)) {
			has[s.ProviderID] = true
		}
		if has[have] && (missing == "" || !has[missing]) {
			return id
		}
	}
	e.t.Fatalf("no customer with %s and without %s", have, missing)
	return ""
}

func activeConsents(s *store.BankStore, customerID string) int {
	n := 0
	for _, c := range s.GetCustomerConsents(customerID) {
		if c.Status == domain.ConsentStatusActive {
			n++
		}
	}
	return n
}

func TestAuthorize_NotConfiguredAnswers503(t *testing.T) {
	e := newAuthzEnv(t, false)
	reqURI, _ := e.par(domain.ProviderBancoDemo)
	resp, body := get(t, e.browser(), e.authorizeURL(reqURI))
	if resp.StatusCode != http.StatusServiceUnavailable || !strings.Contains(body, "no está configurado") {
		t.Fatalf("got %d", resp.StatusCode)
	}
	if r, _ := get(t, e.browser(), e.srv.URL+"/healthz"); r.StatusCode != http.StatusOK {
		t.Fatal("the rest of the simulator must keep working")
	}
}

func TestAuthorize_UnknownOrMismatchedRequestIs400(t *testing.T) {
	e := newAuthzEnv(t, true)
	reqURI, _ := e.par(domain.ProviderBancoDemo)
	for name, u := range map[string]string{
		"unknown":  e.srv.URL + "/oauth/authorize?request_uri=urn:nope&client_id=fynk",
		"client":   e.srv.URL + "/oauth/authorize?" + url.Values{"request_uri": {reqURI}, "client_id": {"other"}}.Encode(),
		"no query": e.srv.URL + "/oauth/authorize",
	} {
		if resp, _ := get(t, e.browser(), u); resp.StatusCode != http.StatusBadRequest {
			t.Errorf("%s: got %d", name, resp.StatusCode)
		}
	}
}

func TestAuthorize_FynkUserAuthorizesAndTheTokenReadsOnlyThatEntity(t *testing.T) {
	e := newAuthzEnv(t, true)
	const entity = domain.ProviderBancoDigitalDemo
	fynkSub := e.customerWith(entity, domain.ProviderCooperativaDemo)
	reqURI, consentID := e.par(entity)
	c := e.browser()
	e.login(c, reqURI, map[string]any{"fynk_sub": fynkSub})

	resp, body := get(t, c, e.authorizeURL(reqURI))
	m := csrfField.FindStringSubmatch(body)
	if resp.StatusCode != http.StatusOK || m == nil {
		t.Fatalf("expected the consent page, got %d", resp.StatusCode)
	}
	for _, want := range []string{"Banco simulado para pruebas. No es un banco real.", "Banco Digital Demo", "Saldos y cuentas", "Movimientos", "Fynk", "365 días", "Autorizar", "Cancelar"} {
		if !strings.Contains(body, want) {
			t.Errorf("consent page lacks %q", want)
		}
	}
	if strings.Contains(body, fynkSub) {
		t.Error("the page must not show the customer id")
	}

	done := e.decide(c, reqURI, m[1], "authorize")
	loc, _ := url.Parse(done.Header.Get("Location"))
	if done.StatusCode != http.StatusSeeOther || loc.Scheme != "fynk" || loc.Query().Get("state") != "fynk-state" || loc.Query().Get("code") == "" {
		t.Fatalf("authorize answered %d %s", done.StatusCode, done.Header.Get("Location"))
	}
	consent, err := e.store.GetConsent(consentID)
	if err != nil || consent.Status != domain.ConsentStatusActive || consent.CustomerID != fynkSub || consent.ProviderID != entity {
		t.Fatalf("consent = %+v, %v", consent, err)
	}

	tok, err := http.PostForm(e.srv.URL+"/oauth/token", url.Values{
		"grant_type": {"authorization_code"}, "code": {loc.Query().Get("code")}, "code_verifier": {authzVerifier},
		"client_id": {"fynk"}, "client_assertion_type": {jwtBearerType}, "client_assertion": {fakeJWT("fynk")},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tok.Body.Close() }()
	var tb struct {
		AccessToken string `json:"access_token"`
	}
	_ = json.NewDecoder(tok.Body).Decode(&tb)
	req, _ := http.NewRequest(http.MethodGet, e.srv.URL+"/open-finance/v1/accounts", nil)
	req.Header.Set("Authorization", "Bearer "+tb.AccessToken)
	accs, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = accs.Body.Close() }()
	var ab struct {
		Data []json.RawMessage `json:"data"`
	}
	_ = json.NewDecoder(accs.Body).Decode(&ab)
	want := 0
	for _, s := range domain.EntitySummaries(e.store.GetCustomer(fynkSub)) {
		if s.ProviderID == entity {
			want = s.AccountCount
		}
	}
	if want == 0 || len(ab.Data) != want {
		t.Fatalf("token read %d accounts, want the %d of %s", len(ab.Data), want, entity)
	}
}

func TestAuthorize_NoProductsShowsTheMessageAndNoActiveConsent(t *testing.T) {
	e := newAuthzEnv(t, true)
	sub := e.customerWith(domain.ProviderBancoDemo, domain.ProviderCooperativaDemo)
	reqURI, consentID := e.par(domain.ProviderCooperativaDemo)
	c := e.browser()
	e.login(c, reqURI, map[string]any{"fynk_sub": sub})

	resp, body := get(t, c, e.authorizeURL(reqURI))
	if resp.StatusCode != http.StatusOK || !strings.Contains(body, "No tienes productos en Cooperativa Demo.") || !strings.Contains(body, "Volver a Fynk") || strings.Contains(body, ">Autorizar<") {
		t.Fatalf("got %d, body: %s", resp.StatusCode, body)
	}
	if activeConsents(e.store, sub) != 0 {
		t.Fatal("a consent became active")
	}
	if cons, _ := e.store.GetConsent(consentID); cons.Status == domain.ConsentStatusActive {
		t.Fatal("the pending consent became active")
	}

	// "Volver a Fynk" sends access_denied, and a forced "authorize" still cannot activate it.
	m := csrfField.FindStringSubmatch(body)
	forced := e.decide(c, reqURI, m[1], "authorize")
	if forced.StatusCode != http.StatusOK || activeConsents(e.store, sub) != 0 {
		t.Fatalf("forced authorize answered %d", forced.StatusCode)
	}
	back := e.decide(c, reqURI, m[1], "cancel")
	loc, _ := url.Parse(back.Header.Get("Location"))
	if back.StatusCode != http.StatusSeeOther || loc.Query().Get("error") != "access_denied" || loc.Query().Get("state") != "fynk-state" {
		t.Fatalf("back answered %d %s", back.StatusCode, back.Header.Get("Location"))
	}
}

func TestAuthorize_CancelReturnsAccessDeniedAndDropsTheRequest(t *testing.T) {
	e := newAuthzEnv(t, true)
	sub := e.customerWith(domain.ProviderBancoDemo, "")
	reqURI, _ := e.par(domain.ProviderBancoDemo)
	c := e.browser()
	e.login(c, reqURI, map[string]any{"fynk_sub": sub})
	_, body := get(t, c, e.authorizeURL(reqURI))
	csrf := csrfField.FindStringSubmatch(body)[1]

	resp := e.decide(c, reqURI, csrf, "cancel")
	loc, _ := url.Parse(resp.Header.Get("Location"))
	if resp.StatusCode != http.StatusSeeOther || loc.Scheme != "fynk" || loc.Query().Get("error") != "access_denied" || loc.Query().Get("code") != "" {
		t.Fatalf("cancel answered %d %s", resp.StatusCode, resp.Header.Get("Location"))
	}
	if activeConsents(e.store, sub) != 0 {
		t.Fatal("cancel left an active consent")
	}
	if again, _ := get(t, c, e.authorizeURL(reqURI)); again.StatusCode != http.StatusBadRequest {
		t.Fatalf("the request must be gone, got %d", again.StatusCode)
	}
}

func TestAuthorize_SecondEntityWithASessionGoesStraightToConsent(t *testing.T) {
	e := newAuthzEnv(t, true)
	sub := e.customerWith(domain.ProviderBancoDemo, "")
	other := ""
	for _, s := range domain.EntitySummaries(e.store.GetCustomer(sub)) {
		if s.ProviderID != domain.ProviderBancoDemo {
			other = s.ProviderID
		}
	}
	if other == "" {
		t.Skip("customer has a single entity")
	}
	c := e.browser()
	first, _ := e.par(domain.ProviderBancoDemo)
	e.login(c, first, map[string]any{"fynk_sub": sub})
	second, _ := e.par(other)
	resp, body := get(t, c, e.authorizeURL(second))
	if resp.StatusCode != http.StatusOK || !strings.Contains(body, ">Autorizar<") || !strings.Contains(body, domain.EntityDisplayName(other)) {
		t.Fatalf("expected the consent page for %s, got %d", other, resp.StatusCode)
	}
}

func TestAuthorize_BankOwnUserUsesItsRealmSub(t *testing.T) {
	e := newAuthzEnv(t, true)
	reqURI, consentID := e.par(domain.ProviderBancoDemo)
	c := e.browser()
	e.login(c, reqURI, map[string]any{"sub": "own-user-sub-1", "preferred_username": "maria"})
	_, body := get(t, c, e.authorizeURL(reqURI))
	resp := e.decide(c, reqURI, csrfField.FindStringSubmatch(body)[1], "authorize")
	cons, _ := e.store.GetConsent(consentID)
	if resp.StatusCode != http.StatusSeeOther || cons.CustomerID != "own-user-sub-1" || cons.Status != domain.ConsentStatusActive {
		t.Fatalf("answered %d, consent %+v", resp.StatusCode, cons)
	}
}

func TestAuthorize_SeededDemoUserKeepsItsData(t *testing.T) {
	e := newAuthzEnv(t, true)
	reqURI, consentID := e.par(domain.ProviderBancoDemo)
	c := e.browser()
	e.login(c, reqURI, map[string]any{"sub": "realm-uuid-1", "preferred_username": domain.DemoCustomerID})
	_, body := get(t, c, e.authorizeURL(reqURI))
	e.decide(c, reqURI, csrfField.FindStringSubmatch(body)[1], "authorize")
	if cons, _ := e.store.GetConsent(consentID); cons.CustomerID != domain.DemoCustomerID {
		t.Fatalf("customer = %q", cons.CustomerID)
	}
}

func TestAuthorize_DecisionNeedsASessionAndACSRFToken(t *testing.T) {
	e := newAuthzEnv(t, true)
	sub := e.customerWith(domain.ProviderBancoDemo, "")
	reqURI, consentID := e.par(domain.ProviderBancoDemo)

	if resp := e.decide(e.browser(), reqURI, "anything", "authorize"); resp.StatusCode != http.StatusForbidden {
		t.Errorf("no session: got %d", resp.StatusCode)
	}
	c := e.browser()
	e.login(c, reqURI, map[string]any{"fynk_sub": sub})
	for _, csrf := range []string{"", "wrong"} {
		if resp := e.decide(c, reqURI, csrf, "authorize"); resp.StatusCode != http.StatusForbidden {
			t.Errorf("csrf %q: got %d", csrf, resp.StatusCode)
		}
	}
	if cons, _ := e.store.GetConsent(consentID); cons.Status == domain.ConsentStatusActive {
		t.Fatal("a rejected decision activated the consent")
	}
	if resp := e.decide(c, "urn:nope", "x", "authorize"); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("unknown request_uri: got %d", resp.StatusCode)
	}
}

func TestAuthorize_CallbackRejectsAForgedLogin(t *testing.T) {
	e := newAuthzEnv(t, true)
	reqURI, _ := e.par(domain.ProviderBancoDemo)
	c := e.browser()
	resp, _ := get(t, c, e.authorizeURL(reqURI))
	loc, _ := url.Parse(resp.Header.Get("Location"))
	state, nonce := loc.Query().Get("state"), loc.Query().Get("nonce")

	// A browser without the login cookie cannot finish somebody else's login.
	e.realm.token = e.realm.idToken(nonce, map[string]any{"fynk_sub": "sub-0001"})
	cb := url.Values{"code": {"c"}, "state": {state}}.Encode()
	if r, _ := get(t, e.browser(), e.srv.URL+"/oauth/authorize/callback?"+cb); r.StatusCode != http.StatusBadRequest {
		t.Errorf("no login cookie: got %d", r.StatusCode)
	}
	// A token with another nonce is refused.
	resp, _ = get(t, c, e.authorizeURL(reqURI))
	loc, _ = url.Parse(resp.Header.Get("Location"))
	e.realm.token = e.realm.idToken("another-nonce", nil)
	cb = url.Values{"code": {"c"}, "state": {loc.Query().Get("state")}}.Encode()
	if r, _ := get(t, c, e.srv.URL+"/oauth/authorize/callback?"+cb); r.StatusCode != http.StatusBadGateway {
		t.Errorf("wrong nonce: got %d", r.StatusCode)
	}
}

func TestAuthorize_CookiesAreHardened(t *testing.T) {
	e := newAuthzEnv(t, true)
	reqURI, _ := e.par(domain.ProviderBancoDemo)
	req, _ := http.NewRequest(http.MethodGet, e.authorizeURL(reqURI), nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	resp, err := e.browser().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	_ = resp.Body.Close()
	cookies := resp.Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || !cookies[0].Secure || cookies[0].SameSite != http.SameSiteLaxMode || cookies[0].Path != "/oauth" {
		t.Fatalf("cookies = %+v", cookies)
	}
}

func TestAuthorize_NeverLogsSecrets(t *testing.T) {
	e := newAuthzEnv(t, true)
	const sub = "7c9e6679-7425-40de-944b-e07fc1f90ae7"
	reqURI, _ := e.par(domain.ProviderBancoDemo)
	c := e.browser()
	e.login(c, reqURI, map[string]any{"fynk_sub": sub, "email": "person@example.com"})
	_, body := get(t, c, e.authorizeURL(reqURI))
	resp := e.decide(c, reqURI, csrfField.FindStringSubmatch(body)[1], "authorize")
	code, _ := url.Parse(resp.Header.Get("Location"))

	// A failing login logs a warning, so the capture is proven to work.
	e.realm.token = "not.a.jwt"
	bad, _ := e.par(domain.ProviderBancoDemo)
	c2 := e.browser()
	resp2, _ := get(t, c2, e.authorizeURL(bad))
	loc, _ := url.Parse(resp2.Header.Get("Location"))
	cb := url.Values{"code": {"realm-code"}, "state": {loc.Query().Get("state")}}.Encode()
	if r, _ := get(t, c2, e.srv.URL+"/oauth/authorize/callback?"+cb); r.StatusCode != http.StatusBadGateway {
		t.Fatalf("bad id token: got %d", r.StatusCode)
	}
	if e.logs.Len() == 0 {
		t.Fatal("expected a log line, so the capture is proven to work")
	}
	for _, secret := range []string{sub, "person@example.com", code.Query().Get("code"), "realm-code", "portal-secret-local-only", "not.a.jwt"} {
		if secret != "" && strings.Contains(e.logs.String(), secret) {
			t.Errorf("a secret appeared in the logs: %s", e.logs.String())
		}
	}
}
