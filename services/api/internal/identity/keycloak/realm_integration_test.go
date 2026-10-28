//go:build integration

// Behavior of the fynk realm on a real Keycloak 26.8.1 built from services/keycloak/Dockerfile
// (with the email code extension), started with testcontainers next to a Mailpit that catches its emails. Needs Docker:
//
//	go test -tags integration -count=1 ./internal/identity/keycloak/...
package keycloak

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/network"
	"github.com/testcontainers/testcontainers-go/wait"
)

const (
	mailpitImage = "axllent/mailpit:v1.31.6"
	clientID     = "fynk-mobile"
	redirectURI  = "co.fynk.app://oauth/callback"
	// Fake values that only live inside the throwaway containers.
	adminUser     = "admin"
	adminPassword = "integration-only-admin"
	goodPassword  = "abcdefg1"
)

// env is the running stack, set once by TestMain.
var env struct {
	keycloak string // http://host:port
	mailpit  string // http://host:port of the Mailpit API
}

func TestMain(m *testing.M) {
	stop, err := startStack(context.Background())
	if err != nil {
		fmt.Fprintln(os.Stderr, "start Keycloak:", err)
		os.Exit(1)
	}
	code := m.Run()
	stop()
	os.Exit(code)
}

func startStack(ctx context.Context) (func(), error) {
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		return nil, fmt.Errorf("cannot locate the test file")
	}
	// services/api/internal/identity/keycloak -> services/keycloak
	kcContext := filepath.Join(filepath.Dir(thisFile), "..", "..", "..", "..", "keycloak")
	nw, err := network.New(ctx)
	if err != nil {
		return nil, err
	}
	mailpit, err := testcontainers.Run(ctx, mailpitImage,
		network.WithNetwork([]string{"mailpit"}, nw),
		testcontainers.WithExposedPorts("8025/tcp"),
		testcontainers.WithWaitStrategy(wait.ForHTTP("/api/v1/info").WithPort("8025/tcp")),
	)
	if err != nil {
		return nil, err
	}
	// The image of the repo: the realms are baked in and the extension is built into it. The
	// build (Maven tests included) runs once per test run. start-dev replaces the optimized
	// start of the image so that plain HTTP works.
	kc, err := testcontainers.Run(ctx, "",
		testcontainers.WithDockerfile(testcontainers.FromDockerfile{
			Context:    kcContext,
			Dockerfile: "Dockerfile",
			Repo:       "fynk-keycloak-it",
			Tag:        "test",
			KeepImage:  true,
		}),
		network.WithNetwork([]string{"keycloak"}, nw),
		testcontainers.WithCmd("start-dev", "--import-realm"),
		testcontainers.WithEnv(map[string]string{
			"KC_BOOTSTRAP_ADMIN_USERNAME": adminUser,
			"KC_BOOTSTRAP_ADMIN_PASSWORD": adminPassword,
			"FYNK_DEMO_USER_PASSWORD":     "Demo-test-1",
			"FYNK_ADMIN_CLIENT_SECRET":    "integration-only-secret",
			"BANCO_DEMO_ADMIN_PASSWORD":   "Banco-admin-test-1",
			"BANCO_DEMO_USER_PASSWORD":    "Banco-user-test-1",
		}),
		testcontainers.WithExposedPorts("8080/tcp"),
		testcontainers.WithWaitStrategy(wait.ForHTTP("/realms/fynk/.well-known/openid-configuration").
			WithPort("8080/tcp").WithStartupTimeout(4*time.Minute)),
	)
	if err != nil {
		return nil, err
	}
	if env.keycloak, err = kc.PortEndpoint(ctx, "8080/tcp", "http"); err != nil {
		return nil, err
	}
	if env.mailpit, err = mailpit.PortEndpoint(ctx, "8025/tcp", "http"); err != nil {
		return nil, err
	}
	return func() {
		_ = testcontainers.TerminateContainer(kc)
		_ = testcontainers.TerminateContainer(mailpit)
		_ = nw.Remove(context.Background())
	}, nil
}

// --- Tests -------------------------------------------------------------------------------

// HU-050: tokens are signed with a published PS256 key.
func TestIntegrationJWKSPublishesAPS256Key(t *testing.T) {
	var jwks struct {
		Keys []struct{ Kid, Alg, Use string }
	}
	getJSON(t, env.keycloak+"/realms/fynk/protocol/openid-connect/certs", &jwks)
	for _, k := range jwks.Keys {
		if k.Alg == "PS256" && k.Use == "sig" {
			return
		}
	}
	t.Fatalf("no PS256 signing key in JWKS: %+v", jwks.Keys)
}

// HU-050 and HU-001: abcdefgh is rejected and abcdefg1 is accepted (prompt example).
func TestIntegrationPasswordPolicy(t *testing.T) {
	for _, tc := range []struct {
		name, password string
		want           int
	}{
		{"no digit", "abcdefgh", http.StatusBadRequest},
		{"no letter", "12345678", http.StatusBadRequest},
		{"too short", "abcde1", http.StatusBadRequest},
		{"letter and digit", goodPassword, http.StatusCreated},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if got := createUser(t, newEmail("policy"), tc.password, true); got.status != tc.want {
				t.Fatalf("status = %d, want %d", got.status, tc.want)
			}
		})
	}
	t.Run("the email as password", func(t *testing.T) {
		email := newEmail("policy1")
		if got := createUser(t, email, email, true); got.status != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", got.status)
		}
	})
}

// HU-001: no two accounts for the same email.
func TestIntegrationDuplicateEmailIsRejected(t *testing.T) {
	email := newEmail("dup")
	if got := createUser(t, email, goodPassword, true); got.status != http.StatusCreated {
		t.Fatalf("first: status = %d", got.status)
	}
	if got := createUser(t, email, goodPassword, true); got.status != http.StatusConflict {
		t.Fatalf("second: status = %d, want 409", got.status)
	}
}

// HU-050: the app must use PKCE S256; the password grant is off.
func TestIntegrationPKCEIsRequiredAndThePasswordGrantIsOff(t *testing.T) {
	for name, q := range map[string]url.Values{
		"no challenge":    authQuery(pkce{}, nil),
		"plain challenge": authQuery(pkce{challenge: "plain-value-long-enough-0123456789-0123456789"}, url.Values{"code_challenge_method": {"plain"}}),
	} {
		t.Run(name, func(t *testing.T) {
			b := newBrowser(t)
			resp := b.get(env.keycloak + "/realms/fynk/protocol/openid-connect/auth?" + q.Encode())
			defer func() { _ = resp.Body.Close() }()
			loc := resp.Header.Get("Location")
			if resp.StatusCode != http.StatusFound || !strings.Contains(loc, "error=invalid_request") {
				t.Fatalf("status = %d, Location = %q, want a redirect with error=invalid_request", resp.StatusCode, loc)
			}
		})
	}
	email := newEmail("grant")
	createUser(t, email, goodPassword, true)
	tok := postToken(t, url.Values{
		"grant_type": {"password"}, "client_id": {clientID}, "username": {email}, "password": {goodPassword},
	})
	if tok.Error == "" {
		t.Fatal("the password grant must be rejected for fynk-mobile")
	}
}

// HU-050 and HU-002: a PKCE login gives PS256 access tokens of 5 minutes for the API audience,
// refresh tokens bound to the 30 day session, and no offline token.
func TestIntegrationLoginGivesPS256TokensForTheAPI(t *testing.T) {
	email := newEmail("login")
	createUser(t, email, goodPassword, true)
	tok := login(t, newBrowser(t), email, goodPassword)

	header, claims := decodeJWT(t, tok.AccessToken)
	if header["alg"] != "PS256" {
		t.Fatalf("alg = %v", header["alg"])
	}
	if exp, iat := claims["exp"].(float64), claims["iat"].(float64); exp-iat != 300 {
		t.Fatalf("access token lives %v s, want 300", exp-iat)
	}
	if !audienceHas(claims["aud"], "fynk-api") || claims["typ"] != "Bearer" || claims["azp"] != clientID {
		t.Fatalf("aud = %v, typ = %v, azp = %v", claims["aud"], claims["typ"], claims["azp"])
	}
	if claims["sub"] == "" || claims["email_verified"] != true {
		t.Fatalf("sub = %v, email_verified = %v", claims["sub"], claims["email_verified"])
	}
	if strings.Contains(tok.Scope, "offline_access") {
		t.Fatalf("scope = %q must not include offline_access", tok.Scope)
	}
	if tok.RefreshExpiresIn < 30*24*3600-5 || tok.RefreshExpiresIn > 30*24*3600 {
		t.Fatalf("refresh_expires_in = %d, want ~30 days", tok.RefreshExpiresIn)
	}
}

// HU-050: refresh tokens rotate and an old one is refused.
func TestIntegrationRefreshTokensRotate(t *testing.T) {
	email := newEmail("rotate")
	createUser(t, email, goodPassword, true)
	first := login(t, newBrowser(t), email, goodPassword)

	second := postToken(t, url.Values{"grant_type": {"refresh_token"}, "client_id": {clientID}, "refresh_token": {first.RefreshToken}})
	if second.Error != "" || second.RefreshToken == "" || second.RefreshToken == first.RefreshToken {
		t.Fatalf("first refresh: error %q, rotated = %v", second.Error, second.RefreshToken != first.RefreshToken)
	}
	reuse := postToken(t, url.Values{"grant_type": {"refresh_token"}, "client_id": {clientID}, "refresh_token": {first.RefreshToken}})
	if reuse.Error != "invalid_grant" {
		t.Fatalf("reusing the old refresh token: error = %q, want invalid_grant", reuse.Error)
	}
}

// HU-001 and HU-050: an unverified email gets no tokens. The login shows the code page, a wrong
// code is refused, and the code from the email verifies the address and continues the login.
func TestIntegrationEmailMustBeVerifiedBeforeTokens(t *testing.T) {
	email := newEmail("verify")
	id := createUser(t, email, goodPassword, false).id
	b := newBrowser(t)
	p := newPKCE()
	page := b.loginPage(p, nil)
	code, page := b.submit(formAction(t, page, "login.ftl"), url.Values{"username": {email}, "password": {goodPassword}})
	if code != "" {
		t.Fatal("an unverified user received an authorization code")
	}
	assertCodePage(t, page)
	mailed := waitForCode(t, email)

	code, page = b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"code": {wrongVariant(mailed)}, "verify": {""}})
	if code != "" {
		t.Fatal("a wrong code gave an authorization code")
	}
	assertCodePage(t, page)
	if !strings.Contains(messageSummary(t, page), "no es correcto") {
		t.Fatal("the code page shows no error for a wrong code")
	}

	code, _ = b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"code": {mailed}, "verify": {""}})
	if code == "" {
		t.Fatal("after the right code the login should continue to the app")
	}
	tok := exchange(t, code, p)
	if _, claims := decodeJWT(t, tok.AccessToken); claims["email_verified"] != true {
		t.Fatal("email_verified should be true in the access token")
	}
	var u kcUser
	adminJSON(t, http.MethodGet, "/admin/realms/fynk/users/"+id, nil, &u)
	if !u.EmailVerified {
		t.Fatal("the admin API shows the email as not verified")
	}
}

// HU-001: sign-up asks for the email, the password and the terms (no cédula). The password
// policy applies, then the emailed code verifies the address before any token is issued. The
// creation date and the terms acceptance are recorded.
func TestIntegrationRegistrationAsksForThePasswordThenTheCode(t *testing.T) {
	b := newBrowser(t)
	p := newPKCE()
	page := b.loginPage(p, url.Values{"prompt": {"create"}})
	// The form is drawn in the browser by the theme, so the server sends what it is drawn from: the
	// terms checkbox and the password pair follow termsAcceptanceRequired and passwordRequired, and
	// the other fields are the user profile attributes.
	reg := kcContextOf(t, page)
	if pageID(t, page) != "register.ftl" || reg["termsAcceptanceRequired"] != true || reg["passwordRequired"] != true {
		t.Fatalf("the registration page does not ask for the terms and the password: %v %v", reg["termsAcceptanceRequired"], reg["passwordRequired"])
	}
	for name := range profileAttributes(t, reg) {
		if regexp.MustCompile(`(?i)c[eé]dula|document|identification`).MatchString(name) {
			t.Fatalf("the registration form has the field %q", name)
		}
	}
	if regexp.MustCompile(`(?i)c[eé]dula`).MatchString(string(mustJSON(t, reg["profile"]))) {
		t.Fatal("the registration profile mentions a cédula")
	}
	email := newEmail("register")
	form := url.Values{"email": {email}, "password": {goodPassword}, "password-confirm": {goodPassword}}

	_, page = b.submit(formAction(t, page, "register.ftl"), form)
	if findUser(t, email) != nil {
		t.Fatal("a user was created without accepting the terms")
	}

	form.Set("termsAccepted", "on")
	form.Set("cedula", "1234567890")
	form.Set("password", "abcdefgh")
	form.Set("password-confirm", "abcdefgh")
	code, page := b.submit(formAction(t, page, "register.ftl"), form)
	if code != "" || findUser(t, email) != nil {
		t.Fatal("abcdefgh (no digit) was accepted as the first password")
	}

	form.Set("password", goodPassword)
	form.Set("password-confirm", goodPassword)
	code, page = b.submit(formAction(t, page, "register.ftl"), form)
	if code != "" {
		t.Fatal("registration must wait for the email code")
	}
	assertCodePage(t, page)
	found := findUser(t, email)
	if found == nil {
		t.Fatal("the user was not created")
	}
	var u kcUser
	adminJSON(t, http.MethodGet, "/admin/realms/fynk/users/"+found.ID, nil, &u)
	if u.CreatedTimestamp == 0 || u.EmailVerified {
		t.Fatalf("createdTimestamp = %d, emailVerified = %v", u.CreatedTimestamp, u.EmailVerified)
	}
	if len(u.Attributes["terms_and_conditions"]) != 1 {
		t.Fatalf("terms acceptance not recorded: %v", u.Attributes)
	}
	for k := range u.Attributes {
		if strings.Contains(strings.ToLower(k), "cedula") {
			t.Fatalf("the cédula was stored as %q", k)
		}
	}

	code, _ = b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"code": {waitForCode(t, email)}, "verify": {""}})
	if code == "" {
		t.Fatal("after the password and the code the sign-up should reach the app")
	}
	exchange(t, code, p)
	adminJSON(t, http.MethodGet, "/admin/realms/fynk/users/"+found.ID, nil, &u)
	if !u.EmailVerified {
		t.Fatal("the email should be verified after the code")
	}
	if again := login(t, newBrowser(t), email, goodPassword); again.AccessToken == "" {
		t.Fatal("the new account cannot sign in")
	}
}

// HU-050: 5 wrong codes kill the code; the right one is then refused until a new one is asked.
func TestIntegrationFiveWrongCodesKillTheCode(t *testing.T) {
	email := newEmail("killcode")
	createUser(t, email, goodPassword, false)
	b := newBrowser(t)
	page := b.loginPage(newPKCE(), nil)
	_, page = b.submit(formAction(t, page, "login.ftl"), url.Values{"username": {email}, "password": {goodPassword}})
	assertCodePage(t, page)
	mailed := waitForCode(t, email)

	for i := 1; i <= 5; i++ {
		var code string
		code, page = b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"code": {wrongVariant(mailed)}, "verify": {""}})
		if code != "" {
			t.Fatalf("wrong code %d gave an authorization code", i)
		}
		assertCodePage(t, page)
	}
	code, page := b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"code": {mailed}, "verify": {""}})
	if code != "" {
		t.Fatal("the right code worked after 5 wrong ones")
	}
	assertCodePage(t, page)
	if !strings.Contains(messageSummary(t, page), "Pide uno nuevo") {
		t.Fatal("the page does not ask for a new code")
	}
}

// HU-050: a second code cannot be asked within 60 seconds of the first.
func TestIntegrationResendInsideTheCooldownIsRefused(t *testing.T) {
	email := newEmail("cooldown")
	createUser(t, email, goodPassword, false)
	b := newBrowser(t)
	page := b.loginPage(newPKCE(), nil)
	_, page = b.submit(formAction(t, page, "login.ftl"), url.Values{"username": {email}, "password": {goodPassword}})
	assertCodePage(t, page)
	waitForCode(t, email)

	code, page := b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"resend": {""}})
	if code != "" {
		t.Fatal("resend gave an authorization code")
	}
	assertCodePage(t, page)
	if !strings.Contains(messageSummary(t, page), "Espera") {
		t.Fatal("the page shows no wait notice")
	}
	time.Sleep(2 * time.Second)
	if n := countMessages(t, email); n != 1 {
		t.Fatalf("%d emails sent to the address, want 1", n)
	}
}

// HU-050 and M13: the send and verify events are stored, with no code and no address.
func TestIntegrationCodeEventsHoldNeitherTheCodeNorTheAddress(t *testing.T) {
	email := newEmail("codeevents")
	id := createUser(t, email, goodPassword, false).id
	b := newBrowser(t)
	page := b.loginPage(newPKCE(), nil)
	_, page = b.submit(formAction(t, page, "login.ftl"), url.Values{"username": {email}, "password": {goodPassword}})
	mailed := waitForCode(t, email)
	if code, _ := b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"code": {mailed}, "verify": {""}}); code == "" {
		t.Fatal("verification failed")
	}
	for _, typ := range []string{"SEND_VERIFY_EMAIL", "VERIFY_EMAIL"} {
		var events []map[string]any
		adminJSON(t, http.MethodGet, "/admin/realms/fynk/events?user="+id+"&type="+typ, nil, &events)
		if len(events) == 0 {
			t.Fatalf("no %s event stored", typ)
		}
		raw, _ := json.Marshal(events)
		if strings.Contains(string(raw), mailed) {
			t.Fatalf("a %s event contains the code", typ)
		}
		if strings.Contains(strings.ToLower(string(raw)), strings.ToLower(email)) {
			t.Fatalf("a %s event contains the email address", typ)
		}
	}
}

// The Banco Demo realm (M16) ships in the same image and still starts.
func TestIntegrationBancoDemoRealmWorksInTheSharedImage(t *testing.T) {
	var cfg struct{ Issuer string }
	getJSON(t, env.keycloak+"/realms/banco-demo/.well-known/openid-configuration", &cfg)
	if !strings.HasSuffix(cfg.Issuer, "/realms/banco-demo") {
		t.Fatalf("issuer = %q", cfg.Issuer)
	}
	b := newBrowser(t)
	_, page := b.follow(env.keycloak + "/realms/banco-demo/protocol/openid-connect/auth?" + url.Values{
		"client_id": {"bank-portal"}, "redirect_uri": {"http://localhost:8082/callback"},
		"response_type": {"code"}, "scope": {"openid"},
	}.Encode())
	// The realm banco-demo sets no login theme: it keeps Keycloak's own, server rendered page, and the
	// fynk theme (which draws pages in the browser from an embedded kcContext) must not leak into it.
	if !strings.Contains(page, `id="kc-form-login"`) || strings.Contains(page, "const kcContext") {
		t.Fatal("the Banco Demo login page did not render with Keycloak's own theme")
	}
}

// HU-005: password recovery with the 6-digit code. The wrong code is refused, the right one
// leads to the new password (policy applies), an info page ends the flow without logging in, the
// new password works, the old one does not, and the other sessions of the user are ended.
func TestIntegrationPasswordResetWithTheCode(t *testing.T) {
	email := newEmail("reset")
	createUser(t, email, goodPassword, true)
	old := login(t, newBrowser(t), email, goodPassword)

	b := newBrowser(t)
	page := startReset(t, b, email)
	assertCodePage(t, page)
	if kcContextOf(t, page)["purpose"] != "reset" {
		t.Fatal("the code page does not have the reset title")
	}
	mailed := waitForCode(t, email)

	code, page := b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"code": {wrongVariant(mailed)}, "verify": {""}})
	if code != "" {
		t.Fatal("a wrong code gave an authorization code")
	}
	assertCodePage(t, page)
	if !strings.Contains(messageSummary(t, page), "no es correcto") {
		t.Fatal("the code page shows no error for a wrong code")
	}

	code, page = b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"code": {mailed}, "verify": {""}})
	if code != "" {
		t.Fatal("the reset gave an authorization code before the new password")
	}
	if pageID(t, page) != "login-update-password.ftl" {
		t.Fatal("after the right code the page should ask for the new password")
	}
	code, page = b.submit(formAction(t, page, "login-update-password.ftl"),
		url.Values{"password-new": {"abcdefgh"}, "password-confirm": {"abcdefgh"}})
	if code != "" || pageID(t, page) != "login-update-password.ftl" {
		t.Fatal("a password that breaks the policy should be refused on the same page")
	}
	code, page = b.submit(formAction(t, page, "login-update-password.ftl"),
		url.Values{"password-new": {"nueva-clave-2"}, "password-confirm": {"nueva-clave-2"}})
	if code != "" {
		t.Fatal("the reset must end on an info page, not log the person in")
	}
	assertResetSuccessPage(t, page)

	if again := login(t, newBrowser(t), email, "nueva-clave-2"); again.AccessToken == "" {
		t.Fatal("the new password does not work")
	}
	_, loginPage := newBrowser(t).submitLogin(t, email, goodPassword)
	if pageID(t, loginPage) != "login.ftl" {
		t.Fatal("the old password should be refused")
	}
	reuse := postToken(t, url.Values{"grant_type": {"refresh_token"}, "client_id": {clientID}, "refresh_token": {old.RefreshToken}})
	if reuse.Error != "invalid_grant" {
		t.Fatalf("the refresh token of the old session: error = %q, want invalid_grant", reuse.Error)
	}
}

// HU-005: an email without an account gets the same page as one with an account, no email is
// sent, and no code (not even a lucky guess) is accepted.
func TestIntegrationUnknownEmailLooksTheSameInTheReset(t *testing.T) {
	known := newEmail("known")
	createUser(t, known, goodPassword, true)
	unknown := newEmail("nobody")

	realBrowser, decoyBrowser := newBrowser(t), newBrowser(t)
	realPage := startReset(t, realBrowser, known)
	decoyPage := startReset(t, decoyBrowser, unknown)
	assertCodePage(t, decoyPage)
	// The theme draws the page in the browser, so the server sends the data model instead of the
	// markup. It is compared whole, key by key, after taking out only what changes from one session
	// to the next (see codePageShape). A second request for the same address inside the cooldown
	// gets the "wait" notice, for a real account and for a decoy alike.
	real2 := startReset(t, newBrowser(t), known)
	real3 := startReset(t, newBrowser(t), known)
	decoy2 := startReset(t, newBrowser(t), unknown)
	// Proof that the normalization takes out nothing but session values: the same account asked
	// twice in the same state gives the same data. And the first page and the waiting page of the
	// same account only differ in the notice and the cooldown.
	if d := shapeDiff(clockFree(codePageShape(t, real2, known)), clockFree(codePageShape(t, real3, known))); len(d) > 0 {
		t.Fatalf("two requests for the same account differ beyond the session values (normalize more):\n%s", strings.Join(d, "\n"))
	}
	onlyNotice := func(k string) bool { return strings.HasPrefix(k, ".message") || k == ".cooldownSeconds" }
	if d := shapeDiffExcept(codePageShape(t, realPage, known), codePageShape(t, real2, known), onlyNotice); len(d) > 0 {
		t.Fatalf("the first and the waiting page of one account differ in more than the notice:\n%s", strings.Join(d, "\n"))
	}
	if d := shapeDiff(codePageShape(t, realPage, known), codePageShape(t, decoyPage, unknown)); len(d) > 0 {
		t.Fatalf("the code pages of a known and an unknown email differ (account enumeration):\n%s", strings.Join(d, "\n"))
	}
	if d := shapeDiff(clockFree(codePageShape(t, real2, known)), clockFree(codePageShape(t, decoy2, unknown))); len(d) > 0 {
		t.Fatalf("the waiting pages of a known and an unknown email differ (account enumeration):\n%s", strings.Join(d, "\n"))
	}
	if outsideContext(realPage, known) != outsideContext(decoyPage, unknown) {
		t.Fatal("the HTML around the data model differs between a known and an unknown email")
	}
	for _, kc := range []map[string]any{kcContextOf(t, realPage), kcContextOf(t, decoyPage)} {
		for _, key := range []string{"auth", "user"} {
			if _, ok := kc[key]; ok {
				t.Fatalf("the code page's data model carries %q: it tells an account from none", key)
			}
		}
	}

	mailed := waitForCode(t, known)
	_, realWrong := realBrowser.submit(formAction(t, realPage, "fynk-email-code.ftl"), url.Values{"code": {wrongVariant(mailed)}, "verify": {""}})
	code, decoyWrong := decoyBrowser.submit(formAction(t, decoyPage, "fynk-email-code.ftl"), url.Values{"code": {"123456"}, "verify": {""}})
	if code != "" || !strings.Contains(messageSummary(t, decoyWrong), "no es correcto") {
		t.Fatal("a 6-digit code for an email without an account must be refused like a wrong code")
	}
	// These pages show the seconds left of each browser's own cooldown, and the two resets above
	// started a moment apart, so the count is checked on its own and left out of the comparison.
	realShape, decoyShape := codePageShape(t, realWrong, known), codePageShape(t, decoyWrong, unknown)
	for _, shape := range []map[string]string{realShape, decoyShape} {
		if n, err := strconv.Atoi(shape[".cooldownSeconds"]); err != nil || n < 1 || n > 60 {
			t.Fatalf("a wrong code page shows a cooldown of %q seconds, want 1 to 60", shape[".cooldownSeconds"])
		}
	}
	if d := shapeDiff(clockFree(realShape), clockFree(decoyShape)); len(d) > 0 {
		t.Fatalf("the wrong code pages differ:\n%s", strings.Join(d, "\n"))
	}

	time.Sleep(time.Second)
	if n := countMessages(t, unknown); n != 0 {
		t.Fatalf("%d emails were sent to an address without an account", n)
	}
}

// HU-005: whoever owns the mailbox can take back an account whose email was never verified (for
// example one somebody else registered with this address). The reset verifies the email.
func TestIntegrationResetVerifiesAnUnverifiedEmail(t *testing.T) {
	email := newEmail("unverified")
	id := createUser(t, email, goodPassword, false).id

	b := newBrowser(t)
	page := startReset(t, b, email)
	assertCodePage(t, page)
	mailed := waitForCode(t, email)
	_, page = b.submit(formAction(t, page, "fynk-email-code.ftl"), url.Values{"code": {mailed}, "verify": {""}})
	_, page = b.submit(formAction(t, page, "login-update-password.ftl"),
		url.Values{"password-new": {"nueva-clave-2"}, "password-confirm": {"nueva-clave-2"}})
	assertResetSuccessPage(t, page)

	// login() needs an authorization code at once: no verification code page in between.
	if tok := login(t, newBrowser(t), email, "nueva-clave-2"); tok.AccessToken == "" {
		t.Fatal("the new password does not log in")
	}
	var u kcUser
	adminJSON(t, http.MethodGet, "/admin/realms/fynk/users/"+id, nil, &u)
	if !u.EmailVerified {
		t.Fatal("the admin API shows the email as not verified after the reset")
	}
}

// HU-050: 5 failures lock the user; the right password then fails too.
func TestIntegrationBruteForceLocksAfter5Failures(t *testing.T) {
	email := newEmail("brute")
	id := createUser(t, email, goodPassword, true).id
	b := newBrowser(t)
	page := b.loginPage(newPKCE(), nil)
	for i := 1; i <= 5; i++ {
		if i == 5 && lockedOut(t, id) {
			t.Fatal("locked before the fifth failure")
		}
		// Keycloak's quick login check locks for a minute when failures come under 1 s apart.
		time.Sleep(1100 * time.Millisecond)
		var code string
		code, page = b.submit(formAction(t, page, "login.ftl"), url.Values{"username": {email}, "password": {"wrong-pass-1"}})
		if code != "" {
			t.Fatal("a wrong password gave a code")
		}
	}
	if !lockedOut(t, id) {
		t.Fatal("not locked after 5 failures")
	}
	if code, _ := b.submit(formAction(t, page, "login.ftl"), url.Values{"username": {email}, "password": {goodPassword}}); code != "" {
		t.Fatal("a locked user signed in")
	}
}

// HU-050 and HU-002: login, error and recovery events are stored for the audit (M13).
func TestIntegrationAuthenticationEventsAreStored(t *testing.T) {
	var cfg struct {
		EventsEnabled     bool
		EnabledEventTypes []string
	}
	adminJSON(t, http.MethodGet, "/admin/realms/fynk/events/config", nil, &cfg)
	if !cfg.EventsEnabled {
		t.Fatal("events are not enabled")
	}
	r, _ := loadRealm(t)
	for _, e := range r.EnabledEventTypes {
		if !slices.Contains(cfg.EnabledEventTypes, e) {
			t.Fatalf("Keycloak dropped event type %s (unknown name?)", e)
		}
	}

	email := newEmail("events")
	createUser(t, email, goodPassword, true)
	b := newBrowser(t)
	page := b.loginPage(newPKCE(), nil)
	_, page = b.submit(formAction(t, page, "login.ftl"), url.Values{"username": {email}, "password": {"wrong-pass-1"}})
	time.Sleep(1100 * time.Millisecond)
	if code, _ := b.submit(formAction(t, page, "login.ftl"), url.Values{"username": {email}, "password": {goodPassword}}); code == "" {
		t.Fatal("login failed")
	}
	for _, typ := range []string{"LOGIN", "LOGIN_ERROR"} {
		var events []map[string]any
		adminJSON(t, http.MethodGet, "/admin/realms/fynk/events?client="+clientID+"&type="+typ, nil, &events)
		if len(events) == 0 {
			t.Fatalf("no %s event stored", typ)
		}
	}
}

// --- Helpers -----------------------------------------------------------------------------

func newEmail(prefix string) string {
	return fmt.Sprintf("%s-%d@test.fynk.local", prefix, time.Now().UnixNano())
}

type pkce struct{ verifier, challenge string }

func newPKCE() pkce {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	v := base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(v))
	return pkce{verifier: v, challenge: base64.RawURLEncoding.EncodeToString(sum[:])}
}

func authQuery(p pkce, extra url.Values) url.Values {
	q := url.Values{
		"client_id": {clientID}, "redirect_uri": {redirectURI}, "response_type": {"code"},
		"scope": {"openid profile email"}, "state": {"test-state"},
	}
	if p.challenge != "" {
		q.Set("code_challenge", p.challenge)
		q.Set("code_challenge_method", "S256")
	}
	for k, v := range extra {
		q[k] = v
	}
	return q
}

// browser keeps Keycloak's cookies and stops at the app redirect, like the system browser.
type browser struct {
	t *testing.T
	c *http.Client
}

func newBrowser(t *testing.T) *browser {
	jar, _ := cookiejar.New(nil)
	return &browser{t: t, c: &http.Client{
		Jar:     jar,
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, _ []*http.Request) error {
			if req.URL.Scheme == "co.fynk.app" {
				return http.ErrUseLastResponse
			}
			return nil
		},
	}}
}

func (b *browser) get(u string) *http.Response {
	b.t.Helper()
	resp, err := b.c.Get(u)
	if err != nil {
		b.t.Fatalf("GET: %v", err)
	}
	return resp
}

// loginPage opens the authorization endpoint and returns the HTML Keycloak shows.
func (b *browser) loginPage(p pkce, extra url.Values) string {
	b.t.Helper()
	_, page := b.follow(env.keycloak + "/realms/fynk/protocol/openid-connect/auth?" + authQuery(p, extra).Encode())
	return page
}

// follow GETs u and returns the authorization code when Keycloak redirects to the app,
// otherwise the HTML of the page.
func (b *browser) follow(u string) (code, page string) {
	b.t.Helper()
	resp := b.get(u)
	defer func() { _ = resp.Body.Close() }()
	return b.read(resp)
}

func (b *browser) submit(action string, form url.Values) (code, page string) {
	b.t.Helper()
	resp, err := b.c.PostForm(action, form)
	if err != nil {
		b.t.Fatalf("POST: %v", err)
	}
	defer func() { _ = resp.Body.Close() }()
	return b.read(resp)
}

// read does not close the body: the caller that made the request does.
func (b *browser) read(resp *http.Response) (code, page string) {
	b.t.Helper()
	if loc := resp.Header.Get("Location"); strings.HasPrefix(loc, redirectURI) {
		u, err := url.Parse(loc)
		if err != nil {
			b.t.Fatal(err)
		}
		if e := u.Query().Get("error"); e != "" {
			b.t.Fatalf("Keycloak redirected with error %q", e)
		}
		return u.Query().Get("code"), ""
	}
	body, _ := io.ReadAll(resp.Body)
	return "", string(body)
}

// formAction returns the URL the form of a page posts to. The fynk theme draws every page in the
// browser (Keycloakify), so there is no <form> in the HTML Keycloak sends: the page embeds the
// FreeMarker data model as kcContext, with the URLs the theme puts in its forms. pageID is the page
// the caller expects to be on, so a flow that ended up somewhere else fails here.
func formAction(t *testing.T, page, pageID string) string {
	t.Helper()
	kc := kcContextOf(t, page)
	if got := pagePageID(kc); got != pageID {
		t.Fatalf("expected page %s, got %q", pageID, got)
	}
	key := "loginAction"
	if pageID == "register.ftl" {
		key = "registrationAction"
	}
	u, _ := kc["url"].(map[string]any)
	action, _ := u[key].(string)
	if action == "" {
		t.Fatalf("page %s has no url.%s", pageID, key)
	}
	return absolute(action)
}

// kcContextOf returns the data model Keycloakify embeds in the page. It is a JavaScript object
// literal, not JSON: it has /* comments */, trailing commas, and functions (messagesPerField).
// toJSON turns it into JSON (functions become null).
func kcContextOf(t *testing.T, page string) map[string]any {
	t.Helper()
	const start = "const kcContext = "
	i := strings.Index(page, start)
	end := strings.Index(page, "\nkcContext.keycloakifyVersion")
	if i < 0 || end < i {
		t.Fatalf("the page has no kcContext (not rendered by the theme?): %.200s", page)
	}
	literal := strings.TrimSpace(page[i+len(start) : end])
	literal = strings.TrimSuffix(literal, ";")
	var kc map[string]any
	if err := json.Unmarshal([]byte(toJSON(literal)), &kc); err != nil {
		t.Fatalf("kcContext is not readable: %v", err)
	}
	// Keycloakify sets the final page id in a statement after the literal ("login.ftl"); the
	// literal holds the short one.
	if m := regexp.MustCompile(`kcContext\.pageId = "([^"]+)";`).FindStringSubmatch(page); m != nil {
		kc["pageId"] = m[1]
	}
	return kc
}

// toJSON turns the object literal Keycloakify writes into JSON: comments are dropped, trailing
// commas too, and a function(...) {...} value becomes null. Strings (double or single quoted) are
// copied as they are.
func toJSON(src string) string {
	var out strings.Builder
	for i := 0; i < len(src); {
		c := src[i]
		switch {
		case c == '"' || c == '\'':
			j := i + 1
			for j < len(src) && src[j] != c {
				if src[j] == '\\' {
					j++
				}
				j++
			}
			out.WriteString(src[i : j+1])
			i = j + 1
		case strings.HasPrefix(src[i:], "/*"):
			end := strings.Index(src[i+2:], "*/")
			if end < 0 {
				return out.String()
			}
			i += end + 4
		case strings.HasPrefix(src[i:], "function"):
			depth, j := 0, strings.Index(src[i:], "{")+i
			for ; j < len(src); j++ {
				switch src[j] {
				case '"', '\'':
					q := src[j]
					for j++; j < len(src) && src[j] != q; j++ {
						if src[j] == '\\' {
							j++
						}
					}
				case '{':
					depth++
				case '}':
					depth--
				}
				if depth == 0 {
					break
				}
			}
			out.WriteString("null")
			i = j + 1
		case c == '}' || c == ']':
			s := strings.TrimRight(out.String(), " \t\r\n")
			s = strings.TrimSuffix(s, ",")
			out.Reset()
			out.WriteString(s)
			out.WriteByte(c)
			i++
		default:
			out.WriteByte(c)
			i++
		}
	}
	return out.String()
}

func pagePageID(kc map[string]any) string {
	id, _ := kc["pageId"].(string)
	return id
}

// pageID returns the page the theme renders (login.ftl, register.ftl, fynk-email-code.ftl, ...).
func pageID(t *testing.T, page string) string {
	t.Helper()
	return pagePageID(kcContextOf(t, page))
}

// messageSummary returns the message Keycloak shows above the form (an error, a warning or a
// notice), or "" when there is none.
func messageSummary(t *testing.T, page string) string {
	t.Helper()
	m, _ := kcContextOf(t, page)["message"].(map[string]any)
	s, _ := m["summary"].(string)
	return s
}

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// profileAttributes returns the user profile attributes of a registration page by name.
func profileAttributes(t *testing.T, kc map[string]any) map[string]bool {
	t.Helper()
	names := map[string]bool{}
	profile, _ := kc["profile"].(map[string]any)
	list, _ := profile["attributes"].([]any)
	for _, a := range list {
		if m, ok := a.(map[string]any); ok {
			if name, ok := m["name"].(string); ok {
				names[name] = true
			}
		}
	}
	if len(names) == 0 {
		t.Fatal("the registration page lists no profile attributes")
	}
	return names
}

func absolute(u string) string {
	if strings.HasPrefix(u, "/") {
		return env.keycloak + u
	}
	return u
}

type tokenResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	RefreshExpiresIn int    `json:"refresh_expires_in"`
	Scope            string `json:"scope"`
	Error            string `json:"error"`
}

func postToken(t *testing.T, form url.Values) tokenResponse {
	t.Helper()
	resp, err := http.PostForm(env.keycloak+"/realms/fynk/protocol/openid-connect/token", form)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var tok tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil {
		t.Fatal(err)
	}
	return tok
}

func exchange(t *testing.T, code string, p pkce) tokenResponse {
	t.Helper()
	tok := postToken(t, url.Values{
		"grant_type": {"authorization_code"}, "client_id": {clientID}, "code": {code},
		"redirect_uri": {redirectURI}, "code_verifier": {p.verifier},
	})
	if tok.Error != "" || tok.AccessToken == "" {
		t.Fatalf("code exchange failed: %q", tok.Error)
	}
	return tok
}

// login runs the whole Authorization Code flow with PKCE, as the app does.
func login(t *testing.T, b *browser, email, password string) tokenResponse {
	t.Helper()
	p := newPKCE()
	page := b.loginPage(p, nil)
	code, _ := b.submit(formAction(t, page, "login.ftl"), url.Values{"username": {email}, "password": {password}})
	if code == "" {
		t.Fatal("login did not reach the app")
	}
	return exchange(t, code, p)
}

func decodeJWT(t *testing.T, token string) (header, claims map[string]any) {
	t.Helper()
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Fatal("not a JWS")
	}
	for i, dst := range []*map[string]any{&header, &claims} {
		raw, err := base64.RawURLEncoding.DecodeString(parts[i])
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(raw, dst); err != nil {
			t.Fatal(err)
		}
	}
	return header, claims
}

func audienceHas(aud any, want string) bool {
	switch a := aud.(type) {
	case string:
		return a == want
	case []any:
		return slices.Contains(a, any(want))
	}
	return false
}

// startReset opens the forgot password page from the login page, submits the email and returns
// the page Keycloak shows next.
func startReset(t *testing.T, b *browser, email string) string {
	t.Helper()
	loginHTML := b.loginPage(newPKCE(), nil)
	link, _ := kcContextOf(t, loginHTML)["url"].(map[string]any)
	resetURL, _ := link["loginResetCredentialsUrl"].(string)
	if !strings.Contains(resetURL, "login-actions/reset-credentials") {
		t.Fatalf("the login page has no forgot password link: %q", resetURL)
	}
	_, resetPage := b.follow(absolute(resetURL))
	code, page := b.submit(formAction(t, resetPage, "login-reset-password.ftl"), url.Values{"username": {email}})
	if code != "" {
		t.Fatal("the reset gave an authorization code")
	}
	return page
}

// submitLogin posts a username and password to a fresh login page.
func (b *browser) submitLogin(t *testing.T, email, password string) (code, page string) {
	t.Helper()
	return b.submit(formAction(t, b.loginPage(newPKCE(), nil), "login.ftl"), url.Values{"username": {email}, "password": {password}})
}

var perSessionParam = regexp.MustCompile(`(session_code|execution|tab_id|client_data|code)=[A-Za-z0-9_.%-]*`)

// perSessionKeys are the contexts' own keys that hold a value of the browser session: they differ
// between two requests for the very same account.
var perSessionKeys = map[string]bool{"authenticationSession": true}

// codePageShape flattens the data model embedded in a code page into path -> value, after taking
// out what changes from one session to the next: the typed email, the session parameters inside
// URLs (session_code, execution, tab_id, client_data) and the authenticationSession bean (ids of
// the browser session). Nothing else is removed, so whatever still differs is information.
func codePageShape(t *testing.T, page, typedEmail string) map[string]string {
	t.Helper()
	out := map[string]string{}
	flatten("", kcContextOf(t, page), typedEmail, out)
	return out
}

func flatten(path string, v any, typedEmail string, out map[string]string) {
	switch x := v.(type) {
	case map[string]any:
		for k, child := range x {
			if path == "" && perSessionKeys[k] {
				continue
			}
			flatten(path+"."+k, child, typedEmail, out)
		}
	case []any:
		for i, child := range x {
			flatten(fmt.Sprintf("%s[%d]", path, i), child, typedEmail, out)
		}
	case string:
		for _, form := range []string{typedEmail, url.QueryEscape(typedEmail), html.EscapeString(typedEmail)} {
			x = strings.ReplaceAll(x, form, "EMAIL")
		}
		out[path] = perSessionParam.ReplaceAllString(x, "$1=S")
	default:
		out[path] = fmt.Sprint(x)
	}
}

var digitRun = regexp.MustCompile(`\d+`)

// clockFree turns the seconds of the cooldown into N: they count down with the time that passes
// between two requests, so they are not information about the account.
func clockFree(shape map[string]string) map[string]string {
	for _, k := range []string{".cooldownSeconds", ".message.summary"} {
		if v, ok := shape[k]; ok {
			shape[k] = digitRun.ReplaceAllString(v, "N")
		}
	}
	return shape
}

func shapeDiff(a, b map[string]string) []string {
	return shapeDiffExcept(a, b, func(string) bool { return false })
}

// shapeDiffExcept lists the paths where two code pages differ (path and both values), leaving out
// the paths for which skip is true.
func shapeDiffExcept(a, b map[string]string, skip func(string) bool) []string {
	var diffs []string
	for k, va := range a {
		if skip(k) {
			continue
		}
		if vb, ok := b[k]; !ok {
			diffs = append(diffs, fmt.Sprintf("%s: only in the first (%q)", k, va))
		} else if va != vb {
			diffs = append(diffs, fmt.Sprintf("%s: %q != %q", k, va, vb))
		}
	}
	for k, vb := range b {
		if skip(k) {
			continue
		}
		if _, ok := a[k]; !ok {
			diffs = append(diffs, fmt.Sprintf("%s: only in the second (%q)", k, vb))
		}
	}
	slices.Sort(diffs)
	return diffs
}

// outsideContext is the page without its embedded kcContext statements and with the session
// parameters taken out: what the browser receives besides the data model.
func outsideContext(page, typedEmail string) string {
	i := strings.Index(page, "const kcContext = ")
	end := strings.Index(page, "\nkcContext.keycloakifyVersion")
	if i >= 0 && end > i {
		page = page[:i] + page[end:]
	}
	for _, form := range []string{typedEmail, url.QueryEscape(typedEmail), html.EscapeString(typedEmail)} {
		page = strings.ReplaceAll(page, form, "EMAIL")
	}
	return perSessionParam.ReplaceAllString(page, "$1=S")
}

// assertResetSuccessPage fails unless the page is the info page that ends a password reset.
func assertResetSuccessPage(t *testing.T, page string) {
	t.Helper()
	if id := pageID(t, page); id != "info.ftl" {
		t.Fatalf("expected the info page after the new password, got %q", id)
	}
	if msg := messageSummary(t, page); !strings.Contains(msg, "actualizado") {
		t.Fatalf("the info page does not confirm the new password: %q", msg)
	}
	// The theme's "Ir a iniciar sesión" link is built from the client_data of the session URLs
	// (theme/src/login/appReturnUrl.ts): it must still carry the redirect URI of the app.
	u, _ := kcContextOf(t, page)["url"].(map[string]any)
	restart, _ := u["loginRestartFlowUrl"].(string)
	parsed, err := url.Parse(restart)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := base64.RawURLEncoding.DecodeString(parsed.Query().Get("client_data"))
	if err != nil {
		t.Fatalf("the info page has no readable client_data: %v", err)
	}
	var data struct{ RU string }
	if err := json.Unmarshal(raw, &data); err != nil || data.RU != redirectURI {
		t.Fatalf("client_data redirect = %q (%v), want %q", data.RU, err, redirectURI)
	}
}

// assertCodePage fails unless the page is the email code page.
func assertCodePage(t *testing.T, page string) {
	t.Helper()
	if pageID(t, page) != "fynk-email-code.ftl" {
		t.Fatal("expected the email code page")
	}
}

// wrongVariant returns a code that differs from the given one in the last digit.
func wrongVariant(code string) string {
	last := code[len(code)-1]
	return code[:len(code)-1] + string('0'+(last-'0'+1)%10)
}

var codeLine = regexp.MustCompile(`(?m)^\s*(\d{6})\s*$`)

// waitForCode returns the 6-digit code in the newest email sent to the address.
func waitForCode(t *testing.T, to string) string {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		var list struct {
			Messages []struct{ ID string }
		}
		// Mailpit lists the newest message first.
		getJSON(t, env.mailpit+"/api/v1/search?limit=1&query="+url.QueryEscape("to:"+to), &list)
		if len(list.Messages) > 0 {
			var msg struct{ Text string }
			getJSON(t, env.mailpit+"/api/v1/message/"+list.Messages[0].ID, &msg)
			if m := codeLine.FindStringSubmatch(msg.Text); m != nil {
				return m[1]
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	t.Fatal("no email with a code arrived")
	return ""
}

// countMessages returns how many emails Mailpit holds for the address.
func countMessages(t *testing.T, to string) int {
	t.Helper()
	var list struct {
		MessagesCount int `json:"messages_count"`
	}
	getJSON(t, env.mailpit+"/api/v1/search?limit=1&query="+url.QueryEscape("to:"+to), &list)
	return list.MessagesCount
}

func getJSON(t *testing.T, u string, dst any) {
	t.Helper()
	resp, err := http.Get(u)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET %s: %d", u, resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(dst); err != nil {
		t.Fatal(err)
	}
}

// --- Admin API ---------------------------------------------------------------------------

func adminToken(t *testing.T) string {
	t.Helper()
	resp, err := http.PostForm(env.keycloak+"/realms/master/protocol/openid-connect/token", url.Values{
		"grant_type": {"password"}, "client_id": {"admin-cli"}, "username": {adminUser}, "password": {adminPassword},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()
	var tok tokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tok); err != nil || tok.AccessToken == "" {
		t.Fatalf("admin token: %v %q", err, tok.Error)
	}
	return tok.AccessToken
}

func adminDo(t *testing.T, method, path string, body any) *http.Response {
	t.Helper()
	var r io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
		r = strings.NewReader(string(raw))
	}
	req, err := http.NewRequest(method, env.keycloak+path, r)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer "+adminToken(t))
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func adminJSON(t *testing.T, method, path string, body, dst any) {
	t.Helper()
	resp := adminDo(t, method, path, body)
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("%s %s: %d", method, path, resp.StatusCode)
	}
	if err := json.NewDecoder(resp.Body).Decode(dst); err != nil {
		t.Fatal(err)
	}
}

type created struct {
	status int
	id     string
}

func createUser(t *testing.T, email, password string, verified bool) created {
	t.Helper()
	resp := adminDo(t, http.MethodPost, "/admin/realms/fynk/users", map[string]any{
		"username": email, "email": email, "enabled": true, "emailVerified": verified,
		"credentials": []map[string]any{{"type": "password", "value": password, "temporary": false}},
	})
	defer func() { _ = resp.Body.Close() }()
	loc := resp.Header.Get("Location")
	return created{status: resp.StatusCode, id: loc[strings.LastIndex(loc, "/")+1:]}
}

type kcUser struct {
	ID               string
	EmailVerified    bool
	CreatedTimestamp int64
	Attributes       map[string][]string
}

func findUser(t *testing.T, email string) *kcUser {
	t.Helper()
	var users []kcUser
	adminJSON(t, http.MethodGet, "/admin/realms/fynk/users?exact=true&email="+url.QueryEscape(email), nil, &users)
	if len(users) == 0 {
		return nil
	}
	return &users[0]
}

func lockedOut(t *testing.T, userID string) bool {
	t.Helper()
	var status struct{ Disabled bool }
	adminJSON(t, http.MethodGet, "/admin/realms/fynk/attack-detection/brute-force/users/"+userID, nil, &status)
	return status.Disabled
}

// --- Code emails ----------------------------------------------------------------------------

// mail is an email as Mailpit stores it.
type mail struct{ Subject, HTML, Text string }

// waitForMail returns the newest email sent to the address once it has a text body.
func waitForMail(t *testing.T, to string) mail {
	t.Helper()
	deadline := time.Now().Add(20 * time.Second)
	for time.Now().Before(deadline) {
		var list struct {
			Messages []struct{ ID string }
		}
		getJSON(t, env.mailpit+"/api/v1/search?limit=1&query="+url.QueryEscape("to:"+to), &list)
		if len(list.Messages) > 0 {
			var m mail
			getJSON(t, env.mailpit+"/api/v1/message/"+list.Messages[0].ID, &m)
			if m.Text != "" {
				return m
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	t.Fatal("no email arrived")
	return mail{}
}

// assertCodeEmail checks the Fynk email theme: the Spanish subject, the code and the expiry in both
// bodies, the wordmark in the HTML, and no links or images (the code is the only way in).
func assertCodeEmail(t *testing.T, m mail, wantSubject, wantHeading string) {
	t.Helper()
	if m.Subject != wantSubject {
		t.Fatalf("subject = %q, want %q", m.Subject, wantSubject)
	}
	digits := regexp.MustCompile(`\b\d{6}\b`)
	for name, body := range map[string]string{"HTML": m.HTML, "Text": m.Text} {
		if !digits.MatchString(body) {
			t.Fatalf("the %s body has no 6-digit code", name)
		}
		lower := strings.ToLower(body)
		for _, banned := range []string{"http://", "https://", "<a ", "<img"} {
			if strings.Contains(lower, banned) {
				t.Fatalf("the %s body contains %q", name, banned)
			}
		}
		if !strings.Contains(body, "El código vence en 10 minutos.") {
			t.Fatalf("the %s body has no expiry sentence", name)
		}
		if !strings.Contains(body, wantHeading) {
			t.Fatalf("the %s body has no heading %q", name, wantHeading)
		}
		if !strings.Contains(body, "Nadie de Fynk te pedirá este código.") {
			t.Fatalf("the %s body has no warning footer", name)
		}
	}
	if !strings.Contains(m.HTML, ">Fynk</div>") {
		t.Fatal("the HTML body has no Fynk wordmark")
	}
	if digits.FindString(m.HTML) != digits.FindString(m.Text) {
		t.Fatal("the HTML and Text bodies carry different codes")
	}
}

// The code emails use the Fynk email theme: Spanish, table layout, no links and no images.
func TestIntegrationCodeEmailsUseTheFynkEmailTheme(t *testing.T) {
	// Verify email: an unverified user logs in.
	verifyTo := newEmail("emailtheme-verify")
	createUser(t, verifyTo, goodPassword, false)
	b := newBrowser(t)
	if code, _ := b.submitLogin(t, verifyTo, goodPassword); code != "" {
		t.Fatal("an unverified user received an authorization code")
	}
	assertCodeEmail(t, waitForMail(t, verifyTo),
		"Tu código para verificar el correo en Fynk", "Verifica tu correo")

	// Password reset.
	resetTo := newEmail("emailtheme-reset")
	createUser(t, resetTo, goodPassword, true)
	startReset(t, newBrowser(t), resetTo)
	assertCodeEmail(t, waitForMail(t, resetTo),
		"Tu código para restablecer la contraseña en Fynk", "Recupera tu contraseña")
}
