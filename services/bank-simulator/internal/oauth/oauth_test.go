package oauth

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/bank-simulator/internal/store"
)

func makeFakeJWT(alg, iss, sub string, exp time.Time) string {
	header := fmt.Sprintf(`{"alg":"%s","typ":"JWT"}`, alg)
	payload := fmt.Sprintf(`{"iss":"%s","sub":"%s","aud":"banco-demo","exp":%d}`, iss, sub, exp.Unix())

	h64 := base64.RawURLEncoding.EncodeToString([]byte(header))
	p64 := base64.RawURLEncoding.EncodeToString([]byte(payload))
	s64 := base64.RawURLEncoding.EncodeToString([]byte("signature-bytes"))

	return fmt.Sprintf("%s.%s.%s", h64, p64, s64)
}

func TestPAR_ValidationAndSuccess(t *testing.T) {
	bankStore := store.NewBankStore(time.Time{})
	oauthSvc := NewService(bankStore)

	mux := http.NewServeMux()
	oauthSvc.RegisterRoutes(mux)
	ts := httptest.NewServer(mux)
	defer ts.Close()

	// 1. Missing PKCE should fail
	form := url.Values{
		"client_id":    {"fynk"},
		"redirect_uri": {"fynk://bank/callback"},
		"scope":        {"openid accounts transactions"},
	}
	resp, err := http.PostForm(ts.URL+"/oauth/par", form)
	if err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for missing PKCE, got %d", resp.StatusCode)
	}
	_ = resp.Body.Close()

	// 2. Insecure client_assertion algorithm should fail
	badJWT := makeFakeJWT("HS256", "fynk", "fynk", time.Now().Add(time.Hour))
	form.Set("code_challenge", "challenge123")
	form.Set("code_challenge_method", "S256")
	form.Set("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer")
	form.Set("client_assertion", badJWT)

	resp, _ = http.PostForm(ts.URL+"/oauth/par", form)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 for insecure HS256 assertion, got %d", resp.StatusCode)
	}
	_ = resp.Body.Close()

	// 3. Valid PS256 assertion and S256 PKCE should succeed
	goodJWT := makeFakeJWT("PS256", "fynk", "fynk", time.Now().Add(time.Hour))
	form.Set("client_assertion", goodJWT)

	resp, err = http.PostForm(ts.URL+"/oauth/par", form)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created for valid PAR, got %d", resp.StatusCode)
	}

	var parRes struct {
		RequestURI string `json:"request_uri"`
		ExpiresIn  int    `json:"expires_in"`
		ConsentID  string `json:"consent_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parRes); err != nil {
		t.Fatalf("failed to decode PAR response: %v", err)
	}

	if !strings.HasPrefix(parRes.RequestURI, "urn:ietf:params:oauth:request_uri:") {
		t.Errorf("invalid request_uri: %s", parRes.RequestURI)
	}
	if parRes.ConsentID == "" {
		t.Errorf("expected non-empty consent_id")
	}
}

func TestOAuthFlow_Complete(t *testing.T) {
	bankStore := store.NewBankStore(time.Time{})
	oauthSvc := NewService(bankStore)

	mux := http.NewServeMux()
	oauthSvc.RegisterRoutes(mux)
	ts := httptest.NewServer(mux)
	defer ts.Close()

	// Step 1: Push Authorization Request (PAR) with PKCE
	verifier := "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
	h := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(h[:])

	jwt := makeFakeJWT("PS256", "fynk", "fynk", time.Now().Add(time.Hour))

	parForm := url.Values{
		"client_id":             {"fynk"},
		"redirect_uri":          {"fynk://bank/callback"},
		"scope":                 {"accounts transactions"},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
		"state":                 {"random-state-123"},
		"client_assertion_type": {"urn:ietf:params:oauth:client-assertion-type:jwt-bearer"},
		"client_assertion":      {jwt},
	}

	parResp, err := http.PostForm(ts.URL+"/oauth/par", parForm)
	if err != nil {
		t.Fatal(err)
	}
	var parRes struct {
		RequestURI string `json:"request_uri"`
		ConsentID  string `json:"consent_id"`
	}
	_ = json.NewDecoder(parResp.Body).Decode(&parRes)
	_ = parResp.Body.Close()

	// Step 2: Complete authorization in simulator
	code, redirect, err := oauthSvc.CompleteAuthorization(parRes.RequestURI, "cliente.demo@bancodemo.local")
	if err != nil {
		t.Fatalf("failed to complete auth: %v", err)
	}
	if !strings.Contains(redirect, "code="+code) || !strings.Contains(redirect, "state=random-state-123") {
		t.Errorf("redirect URI missing code or state: %s", redirect)
	}

	// Step 3: Exchange code for tokens (with invalid verifier first)
	badTokenForm := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {"fynk://bank/callback"},
		"code_verifier": {"wrong-verifier"},
		"client_id":     {"fynk"},
	}
	badResp, _ := http.PostForm(ts.URL+"/oauth/token", badTokenForm)
	if badResp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for wrong verifier, got %d", badResp.StatusCode)
	}
	_ = badResp.Body.Close()

	// Step 4: Exchange code with CORRECT verifier
	goodTokenForm := url.Values{
		"grant_type":            {"authorization_code"},
		"code":                  {code},
		"redirect_uri":          {"fynk://bank/callback"},
		"code_verifier":         {verifier},
		"client_id":             {"fynk"},
		"client_assertion_type": {"urn:ietf:params:oauth:client-assertion-type:jwt-bearer"},
		"client_assertion":      {jwt},
	}
	tokenResp, err := http.PostForm(ts.URL+"/oauth/token", goodTokenForm)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tokenResp.Body.Close() }()

	if tokenResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK for token exchange, got %d", tokenResp.StatusCode)
	}

	var tokenRes struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ConsentID    string `json:"consent_id"`
	}
	if err := json.NewDecoder(tokenResp.Body).Decode(&tokenRes); err != nil {
		t.Fatalf("failed to decode tokens: %v", err)
	}

	if tokenRes.ConsentID != parRes.ConsentID {
		t.Errorf("expected consent_id %s, got %s", parRes.ConsentID, tokenRes.ConsentID)
	}

	// Step 5: Refresh token
	rfForm := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {tokenRes.RefreshToken},
	}
	rfResp, err := http.PostForm(ts.URL+"/oauth/token", rfForm)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rfResp.Body.Close() }()
	if rfResp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for refresh token, got %d", rfResp.StatusCode)
	}

	// Step 6: Revoke token
	revForm := url.Values{
		"token": {tokenRes.ConsentID},
	}
	revResp, err := http.PostForm(ts.URL+"/oauth/revoke", revForm)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = revResp.Body.Close() }()
	if revResp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for revoke, got %d", revResp.StatusCode)
	}

	// Verify consent is now revoked in store
	_, err = bankStore.GetAccounts(tokenRes.ConsentID)
	if err != store.ErrConsentRevoked {
		t.Errorf("expected ErrConsentRevoked, got %v", err)
	}
}
