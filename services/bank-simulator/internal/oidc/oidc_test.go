package oidc

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const (
	testIssuer   = "http://localhost:8081/realms/banco-demo"
	testClientID = "bank-portal"
	testNonce    = "nonce-1"
)

type fakeKeycloak struct {
	t        *testing.T
	srv      *httptest.Server
	key      *rsa.PrivateKey
	kid      string
	jwksHits atomic.Int32
	idToken  string
	form     url.Values
}

func newFake(t *testing.T) *fakeKeycloak {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	f := &fakeKeycloak{t: t, key: key, kid: "k1"}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /protocol/openid-connect/certs", func(w http.ResponseWriter, _ *http.Request) {
		f.jwksHits.Add(1)
		_ = json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]string{{
			"kid": f.kid, "kty": "RSA", "use": "sig",
			"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	})
	mux.HandleFunc("POST /protocol/openid-connect/token", func(w http.ResponseWriter, r *http.Request) {
		_ = r.ParseForm()
		f.form = r.PostForm
		_ = json.NewEncoder(w).Encode(map[string]string{"id_token": f.idToken})
	})
	f.srv = httptest.NewServer(mux)
	t.Cleanup(f.srv.Close)
	return f
}

func (f *fakeKeycloak) client() *Client {
	return New(Config{Issuer: testIssuer, BackchannelURL: f.srv.URL, ClientID: testClientID, ClientSecret: "s", RedirectURL: "http://localhost:8082/oauth/authorize/callback"})
}

func b64(v any) string {
	b, _ := json.Marshal(v)
	return base64.RawURLEncoding.EncodeToString(b)
}

func (f *fakeKeycloak) signWith(key *rsa.PrivateKey, alg, kid string, claims map[string]any) string {
	signing := b64(map[string]string{"alg": alg, "kid": kid}) + "." + b64(claims)
	digest := sha256.Sum256([]byte(signing))
	sig, err := rsa.SignPSS(rand.Reader, key, crypto.SHA256, digest[:], &rsa.PSSOptions{SaltLength: rsa.PSSSaltLengthEqualsHash})
	if err != nil {
		f.t.Fatal(err)
	}
	return signing + "." + base64.RawURLEncoding.EncodeToString(sig)
}

func (f *fakeKeycloak) sign(alg string, claims map[string]any) string {
	return f.signWith(f.key, alg, f.kid, claims)
}

func goodClaims() map[string]any {
	return map[string]any{
		"iss": testIssuer, "aud": testClientID, "azp": testClientID, "sub": "bank-sub",
		"exp": time.Now().Add(time.Hour).Unix(), "nonce": testNonce, "fynk_sub": "fynk-1", "preferred_username": "u",
	}
}

func TestVerifyIDToken_AcceptsAValidToken(t *testing.T) {
	f := newFake(t)
	got, err := f.client().VerifyIDToken(context.Background(), f.sign("PS256", goodClaims()), testNonce)
	if err != nil {
		t.Fatal(err)
	}
	if got.Subject != "bank-sub" || got.FynkSub != "fynk-1" || got.PreferredUsername != "u" {
		t.Fatalf("claims = %+v", got)
	}
}

func TestVerifyIDToken_Rejects(t *testing.T) {
	f := newFake(t)
	other, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	with := func(k string, v any) map[string]any {
		c := goodClaims()
		c[k] = v
		return c
	}
	hs := b64(map[string]string{"alg": "HS256", "kid": "k1"}) + "." + b64(goodClaims()) + ".c2ln"
	none := b64(map[string]string{"alg": "none"}) + "." + b64(goodClaims()) + "."
	tests := map[string]string{
		"RS256":         f.sign("RS256", goodClaims()),
		"HS256":         hs,
		"none":          none,
		"bad signature": f.signWith(other, "PS256", "k1", goodClaims()),
		"wrong iss":     f.sign("PS256", with("iss", "http://evil/realms/x")),
		"wrong aud":     f.sign("PS256", with("aud", "other-client")),
		"two aud, azp":  f.sign("PS256", func() map[string]any { c := with("aud", []string{testClientID, "x"}); c["azp"] = "x"; return c }()),
		"wrong nonce":   f.sign("PS256", with("nonce", "other")),
		"expired":       f.sign("PS256", with("exp", time.Now().Add(-time.Minute).Unix())),
		"malformed":     "a.b",
	}
	for name, tok := range tests {
		t.Run(name, func(t *testing.T) {
			if _, err := f.client().VerifyIDToken(context.Background(), tok, testNonce); err == nil {
				t.Fatal("token was accepted")
			}
		})
	}
}

func TestVerifyIDToken_TwoAudiencesWithMatchingAzpPass(t *testing.T) {
	f := newFake(t)
	c := goodClaims()
	c["aud"] = []string{testClientID, "account"}
	if _, err := f.client().VerifyIDToken(context.Background(), f.sign("PS256", c), testNonce); err != nil {
		t.Fatal(err)
	}
}

func TestKeys_AreCachedAndAnUnknownKidRefetchesOnce(t *testing.T) {
	f := newFake(t)
	c := f.client()
	tok := f.sign("PS256", goodClaims())
	for i := 0; i < 3; i++ {
		if _, err := c.VerifyIDToken(context.Background(), tok, testNonce); err != nil {
			t.Fatal(err)
		}
	}
	if f.jwksHits.Load() != 1 {
		t.Fatalf("jwks fetched %d times, want 1", f.jwksHits.Load())
	}
	// The realm rotates to a new kid: one refetch finds it.
	f.kid = "rotated"
	if _, err := c.VerifyIDToken(context.Background(), f.sign("PS256", goodClaims()), testNonce); err != nil {
		t.Fatal(err)
	}
	if f.jwksHits.Load() != 2 {
		t.Fatalf("jwks fetched %d times, want 2", f.jwksHits.Load())
	}
	// A kid the realm never serves: one refetch, then a rejection.
	ghost := f.signWith(f.key, "PS256", "ghost", goodClaims())
	if _, err := c.VerifyIDToken(context.Background(), ghost, testNonce); err == nil {
		t.Fatal("unknown kid was accepted")
	}
	if f.jwksHits.Load() != 3 {
		t.Fatalf("jwks fetched %d times, want 3", f.jwksHits.Load())
	}
}

func TestAuthURL_UsesTheIssuerAndPKCE(t *testing.T) {
	c := New(Config{Issuer: testIssuer, ClientID: testClientID, RedirectURL: "http://localhost:8082/cb"})
	u, err := url.Parse(c.AuthURL("st", "no", "verifier"))
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	sum := sha256.Sum256([]byte("verifier"))
	if !strings.HasPrefix(u.String(), testIssuer+"/protocol/openid-connect/auth?") ||
		q.Get("response_type") != "code" || q.Get("scope") != "openid" || q.Get("state") != "st" || q.Get("nonce") != "no" ||
		q.Get("code_challenge_method") != "S256" || q.Get("code_challenge") != base64.RawURLEncoding.EncodeToString(sum[:]) {
		t.Fatalf("auth url = %s", u)
	}
}

func TestExchange_PostsTheCodeWithPKCEAndReturnsTheIDToken(t *testing.T) {
	f := newFake(t)
	f.idToken = "the.id.token"
	got, err := f.client().Exchange(context.Background(), "code-1", "ver-1")
	if err != nil || got != "the.id.token" {
		t.Fatalf("got %q, %v", got, err)
	}
	if f.form.Get("grant_type") != "authorization_code" || f.form.Get("code") != "code-1" || f.form.Get("code_verifier") != "ver-1" || f.form.Get("client_secret") != "s" {
		t.Fatalf("form = %v", f.form)
	}
}

func TestExchange_FailsWithoutAnIDToken(t *testing.T) {
	f := newFake(t)
	if _, err := f.client().Exchange(context.Background(), "c", "v"); err == nil {
		t.Fatal("expected an error")
	}
}
