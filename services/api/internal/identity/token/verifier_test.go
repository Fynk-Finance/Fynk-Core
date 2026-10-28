package token

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"log/slog"
	"math/big"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

const (
	issuer   = "http://localhost:8081/realms/fynk"
	audience = "fynk-api"
)

var start = time.Date(2026, 10, 27, 15, 0, 0, 0, time.UTC)

// RSA keys are slow to generate, so the tests share three.
var (
	keysOnce         sync.Once
	keyA, keyB, keyC *rsa.PrivateKey
)

func testKeys(t *testing.T) (a, b, c *rsa.PrivateKey) {
	t.Helper()
	keysOnce.Do(func() {
		for _, k := range []**rsa.PrivateKey{&keyA, &keyB, &keyC} {
			var err error
			if *k, err = rsa.GenerateKey(rand.Reader, 2048); err != nil {
				panic(err)
			}
		}
	})
	return keyA, keyB, keyC
}

// publishedKey is one entry of the JWKS the fake Keycloak publishes.
type publishedKey struct {
	Kid, Alg, Use string
	Key           *rsa.PublicKey
}

// fakeKeycloak serves a JWKS that tests can change, and counts the fetches.
type fakeKeycloak struct {
	srv     *httptest.Server
	mu      sync.Mutex
	keys    []publishedKey
	status  int
	fetches atomic.Int32
}

func newFakeKeycloak(t *testing.T, keys ...publishedKey) *fakeKeycloak {
	t.Helper()
	f := &fakeKeycloak{keys: keys, status: http.StatusOK}
	f.srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		f.fetches.Add(1)
		f.mu.Lock()
		defer f.mu.Unlock()
		if f.status != http.StatusOK {
			w.WriteHeader(f.status)
			return
		}
		doc := map[string][]map[string]string{"keys": {}}
		for _, k := range f.keys {
			doc["keys"] = append(doc["keys"], map[string]string{
				"kid": k.Kid, "kty": "RSA", "alg": k.Alg, "use": k.Use,
				"n": base64.RawURLEncoding.EncodeToString(k.Key.N.Bytes()),
				"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(k.Key.E)).Bytes()),
			})
		}
		_ = json.NewEncoder(w).Encode(doc)
	}))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeKeycloak) set(status int, keys ...publishedKey) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.status, f.keys = status, keys
}

type fixture struct {
	kc    *fakeKeycloak
	clock *clock.Fixed
	v     *Verifier
	logs  *bytes.Buffer
}

func newFixture(t *testing.T, keys ...publishedKey) fixture {
	t.Helper()
	kc := newFakeKeycloak(t, keys...)
	clk := clock.NewFixed(start)
	logs := &bytes.Buffer{}
	v, err := New(Config{
		Issuer: issuer, Audience: audience, JWKSURL: kc.srv.URL, Clock: clk,
		Log: slog.New(slog.NewTextHandler(logs, nil)),
	})
	if err != nil {
		t.Fatal(err)
	}
	return fixture{kc: kc, clock: clk, v: v, logs: logs}
}

func psKey(t *testing.T, kid string, k *rsa.PrivateKey) publishedKey {
	t.Helper()
	return publishedKey{Kid: kid, Alg: "PS256", Use: "sig", Key: &k.PublicKey}
}

// claims of a Keycloak access token for the app, valid at start.
func accessClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"iss": issuer, "aud": audience, "sub": "user-1", "typ": "Bearer", "azp": "fynk-mobile",
		"email_verified": true, "iat": start.Unix(), "exp": start.Add(5 * time.Minute).Unix(),
	}
}

func sign(t *testing.T, method jwt.SigningMethod, key any, kid string, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(method, claims)
	if kid != "" {
		tok.Header["kid"] = kid
	}
	s, err := tok.SignedString(key)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func mustReject(t *testing.T, v auth.Verifier, token string) {
	t.Helper()
	if _, err := v.Verify(context.Background(), token, ""); !errors.Is(err, auth.ErrInvalidToken) {
		t.Fatalf("err = %v, want auth.ErrInvalidToken", err)
	}
}

func TestAcceptsAValidPS256Token(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	u, err := f.v.Verify(context.Background(), sign(t, jwt.SigningMethodPS256, a, "a", accessClaims()), "")
	if err != nil {
		t.Fatal(err)
	}
	if u != (auth.User{ID: "user-1", EmailVerified: true}) {
		t.Fatalf("user = %+v", u)
	}
}

// HU-002: only PS256. RS256 with the same key, HS256 (also keyed with the public key, the
// classic algorithm confusion) and "none" are rejected.
func TestRejectsEveryOtherAlgorithm(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	der, err := x509.MarshalPKIXPublicKey(&a.PublicKey)
	if err != nil {
		t.Fatal(err)
	}
	for name, token := range map[string]string{
		"RS256":                 sign(t, jwt.SigningMethodRS256, a, "a", accessClaims()),
		"PS384":                 sign(t, jwt.SigningMethodPS384, a, "a", accessClaims()),
		"HS256":                 sign(t, jwt.SigningMethodHS256, []byte("a-shared-secret-of-32-bytes!!!!!"), "a", accessClaims()),
		"HS256 keyed with JWKS": sign(t, jwt.SigningMethodHS256, der, "a", accessClaims()),
		"none":                  sign(t, jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, "a", accessClaims()),
		"not a JWT":             "dev-token",
		"PS256 without kid":     sign(t, jwt.SigningMethodPS256, a, "", accessClaims()),
	} {
		t.Run(name, func(t *testing.T) { mustReject(t, f.v, token) })
	}
}

func TestRejectsAKnownKidSignedByAnotherKey(t *testing.T) {
	a, b, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	mustReject(t, f.v, sign(t, jwt.SigningMethodPS256, b, "a", accessClaims()))
}

func TestChecksIssuerAndAudience(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	for name, change := range map[string]func(jwt.MapClaims){
		"other issuer":   func(c jwt.MapClaims) { c["iss"] = "http://localhost:8081/realms/banco-demo" },
		"other audience": func(c jwt.MapClaims) { c["aud"] = "account" },
		"no audience":    func(c jwt.MapClaims) { delete(c, "aud") },
	} {
		t.Run(name, func(t *testing.T) {
			c := accessClaims()
			change(c)
			mustReject(t, f.v, sign(t, jwt.SigningMethodPS256, a, "a", c))
		})
	}
	c := accessClaims()
	c["aud"] = []string{"account", audience}
	if _, err := f.v.Verify(context.Background(), sign(t, jwt.SigningMethodPS256, a, "a", c), ""); err != nil {
		t.Fatalf("an audience list with fynk-api must pass: %v", err)
	}
}

// Expiry, not-before and issued-at are checked with 30 s of clock skew.
func TestTimeClaimsAllow30SecondsOfSkew(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	for _, tc := range []struct {
		name  string
		claim string
		at    time.Time
		ok    bool
	}{
		{"expired 29 s ago", "exp", start.Add(-29 * time.Second), true},
		{"expired 31 s ago", "exp", start.Add(-31 * time.Second), false},
		{"valid from in 29 s", "nbf", start.Add(29 * time.Second), true},
		{"valid from in 31 s", "nbf", start.Add(31 * time.Second), false},
		{"issued in 31 s", "iat", start.Add(31 * time.Second), false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c := accessClaims()
			c[tc.claim] = tc.at.Unix()
			_, err := f.v.Verify(context.Background(), sign(t, jwt.SigningMethodPS256, a, "a", c), "")
			if (err == nil) != tc.ok {
				t.Fatalf("err = %v, want ok = %v", err, tc.ok)
			}
		})
	}
	c := accessClaims()
	delete(c, "exp")
	mustReject(t, f.v, sign(t, jwt.SigningMethodPS256, a, "a", c))
}

// ID and refresh tokens of the same realm are not access tokens.
func TestRejectsTokensThatAreNotAccessTokens(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	for name, change := range map[string]func(jwt.MapClaims){
		"ID token":   func(c jwt.MapClaims) { c["typ"] = "ID" },
		"no typ":     func(c jwt.MapClaims) { delete(c, "typ") },
		"no subject": func(c jwt.MapClaims) { delete(c, "sub") },
	} {
		t.Run(name, func(t *testing.T) {
			c := accessClaims()
			change(c)
			mustReject(t, f.v, sign(t, jwt.SigningMethodPS256, a, "a", c))
		})
	}
}

func TestJWKSIsCachedFor10Minutes(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	verifyAt := func(at time.Time) {
		t.Helper()
		f.clock.Set(at)
		c := accessClaims()
		c["iat"], c["exp"] = at.Unix(), at.Add(5*time.Minute).Unix()
		if _, err := f.v.Verify(context.Background(), sign(t, jwt.SigningMethodPS256, a, "a", c), ""); err != nil {
			t.Fatal(err)
		}
	}
	verifyAt(start)
	verifyAt(start.Add(9*time.Minute + 59*time.Second))
	if n := f.kc.fetches.Load(); n != 1 {
		t.Fatalf("fetches within 10 minutes = %d, want 1", n)
	}
	verifyAt(start.Add(10 * time.Minute))
	if n := f.kc.fetches.Load(); n != 2 {
		t.Fatalf("fetches after 10 minutes = %d, want 2", n)
	}
}

// After a key rotation the new kid is unknown: one refetch finds it. Unknown kids refetch at
// most once every 30 s, so random kids cannot make the API hammer Keycloak.
func TestUnknownKidRefetchesAtMostEvery30Seconds(t *testing.T) {
	a, b, c := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	if _, err := f.v.Verify(context.Background(), sign(t, jwt.SigningMethodPS256, a, "a", accessClaims()), ""); err != nil {
		t.Fatal(err)
	}
	f.kc.set(http.StatusOK, psKey(t, "a", a), psKey(t, "b", b))
	if _, err := f.v.Verify(context.Background(), sign(t, jwt.SigningMethodPS256, b, "b", accessClaims()), ""); err != nil {
		t.Fatalf("rotated key: %v", err)
	}
	if n := f.kc.fetches.Load(); n != 2 {
		t.Fatalf("fetches = %d, want 2", n)
	}
	unknown := sign(t, jwt.SigningMethodPS256, c, "c", accessClaims())
	mustReject(t, f.v, unknown)
	if n := f.kc.fetches.Load(); n != 2 {
		t.Fatalf("an unknown kid refetched within 30 s (fetches = %d)", n)
	}
	f.clock.Advance(31 * time.Second)
	mustReject(t, f.v, unknown)
	if n := f.kc.fetches.Load(); n != 3 {
		t.Fatalf("fetches after 30 s = %d, want 3", n)
	}
}

// Without fresh keys nothing passes: no fallback to keys older than 10 minutes.
func TestFailsClosedWhenTheJWKSCannotBeFetched(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	f.kc.set(http.StatusInternalServerError)
	mustReject(t, f.v, sign(t, jwt.SigningMethodPS256, a, "a", accessClaims()))

	f.kc.set(http.StatusOK, psKey(t, "a", a))
	if _, err := f.v.Verify(context.Background(), sign(t, jwt.SigningMethodPS256, a, "a", accessClaims()), ""); err != nil {
		t.Fatal(err)
	}
	f.kc.set(http.StatusServiceUnavailable)
	f.clock.Advance(10 * time.Minute)
	c := accessClaims()
	c["iat"], c["exp"] = f.clock.Now().Unix(), f.clock.Now().Add(5*time.Minute).Unix()
	mustReject(t, f.v, sign(t, jwt.SigningMethodPS256, a, "a", c))

	f.kc.srv.Close()
	f.clock.Advance(time.Minute)
	mustReject(t, f.v, sign(t, jwt.SigningMethodPS256, a, "a", c))
}

// Only RSA signing keys meant for PS256 are used.
func TestIgnoresKeysThatAreNotPS256SigningKeys(t *testing.T) {
	a, b, _ := testKeys(t)
	f := newFixture(t,
		publishedKey{Kid: "rs", Alg: "RS256", Use: "sig", Key: &a.PublicKey},
		publishedKey{Kid: "enc", Alg: "RSA-OAEP", Use: "enc", Key: &b.PublicKey},
	)
	mustReject(t, f.v, sign(t, jwt.SigningMethodPS256, a, "rs", accessClaims()))
	mustReject(t, f.v, sign(t, jwt.SigningMethodPS256, b, "enc", accessClaims()))
}

type fakeDevices map[string]bool // "<user>/<device>" -> usable

func (d fakeDevices) Usable(_ context.Context, userID, deviceID string) (bool, error) {
	return d[userID+"/"+deviceID], nil
}

// X-Device-Id is only trusted after the identity module checked it against identity.devices.
func TestDeviceIDIsOnlyTrustedWhenChecked(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	token := sign(t, jwt.SigningMethodPS256, a, "a", accessClaims())

	if u, _ := f.v.Verify(context.Background(), token, "device-1"); u.DeviceID != "" {
		t.Fatal("without a device checker the device id must stay empty")
	}
	f.v.cfg.Devices = fakeDevices{"user-1/device-1": true}
	if u, _ := f.v.Verify(context.Background(), token, "device-1"); u.DeviceID != "device-1" {
		t.Fatalf("checked device: DeviceID = %q", u.DeviceID)
	}
	if u, _ := f.v.Verify(context.Background(), token, "device-2"); u.DeviceID != "" {
		t.Fatalf("unknown device: DeviceID = %q", u.DeviceID)
	}
}

// End to end through M0's middleware: 401 problem JSON, or the user in the context.
func TestRequireUsesTheVerifier(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	auth.Install(f.v)
	t.Cleanup(func() { auth.Install(nil) })
	h := auth.Require(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, _ := auth.UserFrom(r.Context())
		w.Header().Set("X-User", u.ID)
	}))
	call := func(token string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		return rec
	}
	if rec := call(sign(t, jwt.SigningMethodRS256, a, "a", accessClaims())); rec.Code != http.StatusUnauthorized ||
		rec.Header().Get("Content-Type") != "application/problem+json" {
		t.Fatalf("RS256: %d %s", rec.Code, rec.Header().Get("Content-Type"))
	}
	if rec := call(sign(t, jwt.SigningMethodPS256, a, "a", accessClaims())); rec.Code != http.StatusOK || rec.Header().Get("X-User") != "user-1" {
		t.Fatalf("PS256: %d user %q", rec.Code, rec.Header().Get("X-User"))
	}
}

// Security rules: tokens and emails never reach the logs, even when checks fail.
func TestNeverLogsTokensOrEmails(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	c := accessClaims()
	c["email"] = "persona@correo.com"
	good := sign(t, jwt.SigningMethodPS256, a, "a", c)
	_, _ = f.v.Verify(context.Background(), good, "")
	_, _ = f.v.Verify(context.Background(), sign(t, jwt.SigningMethodRS256, a, "a", c), "")
	f.kc.set(http.StatusInternalServerError)
	f.clock.Advance(11 * time.Minute)
	_, _ = f.v.Verify(context.Background(), good, "")

	out := f.logs.String()
	if out == "" {
		t.Fatal("expected a log line about the failed JWKS fetch")
	}
	for _, secret := range []string{good[:20], strings.Split(good, ".")[1][:20], "persona@correo.com"} {
		if strings.Contains(out, secret) {
			t.Fatalf("the logs contain %q", secret)
		}
	}
}

func TestNewNeedsIssuerAudienceAndJWKSURL(t *testing.T) {
	for name, cfg := range map[string]Config{
		"no issuer":   {Audience: audience, JWKSURL: "http://keycloak:8080/certs"},
		"no audience": {Issuer: issuer, JWKSURL: "http://keycloak:8080/certs"},
		"no JWKS URL": {Issuer: issuer, Audience: audience},
		"bad URL":     {Issuer: issuer, Audience: audience, JWKSURL: "keycloak:8080/certs"},
	} {
		if _, err := New(cfg); err == nil {
			t.Fatalf("%s: New accepted the config", name)
		}
	}
}

func TestJWKSURL(t *testing.T) {
	want := "http://keycloak:8080/realms/fynk/protocol/openid-connect/certs"
	for _, base := range []string{"http://keycloak:8080", "http://keycloak:8080/"} {
		if got := JWKSURL(base, "fynk"); got != want {
			t.Fatalf("JWKSURL(%q) = %q", base, got)
		}
	}
}
