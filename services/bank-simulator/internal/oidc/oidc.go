// Package oidc is the small OpenID Connect client the authorization page uses
// to log a person in through the banco-demo realm. Standard library only.
//
// ID tokens are accepted only when signed with PS256, matching the Keycloak
// realm setting. Every other algorithm is rejected before any key is used.
// Nothing here logs a token, a code or a claim.
package oidc

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	algPS256     = "PS256"
	authPath     = "/protocol/openid-connect/auth"
	tokenPath    = "/protocol/openid-connect/token"
	certsPath    = "/protocol/openid-connect/certs"
	maxBodyBytes = 1 << 20
)

// Config says where the realm is and who the simulator is at it.
type Config struct {
	// Issuer is the public realm URL. The browser goes there and `iss` must equal it.
	Issuer string
	// BackchannelURL is the realm URL the simulator itself calls for the token and the keys.
	// Empty means the same as Issuer.
	BackchannelURL string
	ClientID       string
	ClientSecret   string
	// RedirectURL is the callback registered for the client.
	RedirectURL string
	HTTPClient  *http.Client
	Now         func() time.Time
}

// Claims are the few ID token claims the simulator reads.
type Claims struct {
	Subject           string
	PreferredUsername string
	FynkSub           string
}

type Client struct {
	cfg  Config
	http *http.Client

	mu   sync.Mutex
	keys map[string]*rsa.PublicKey
}

func New(cfg Config) *Client {
	cfg.Issuer = strings.TrimRight(cfg.Issuer, "/")
	cfg.BackchannelURL = strings.TrimRight(cfg.BackchannelURL, "/")
	if cfg.BackchannelURL == "" {
		cfg.BackchannelURL = cfg.Issuer
	}
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	hc := cfg.HTTPClient
	if hc == nil {
		hc = &http.Client{Timeout: 10 * time.Second}
	}
	return &Client{cfg: cfg, http: hc, keys: map[string]*rsa.PublicKey{}}
}

// RandomString returns a URL safe random string for state, nonce and verifiers.
func RandomString() string {
	b := make([]byte, 32)
	_, _ = rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// AuthURL builds the code flow URL with PKCE S256.
func (c *Client) AuthURL(state, nonce, verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	q := url.Values{
		"response_type":         {"code"},
		"client_id":             {c.cfg.ClientID},
		"redirect_uri":          {c.cfg.RedirectURL},
		"scope":                 {"openid"},
		"state":                 {state},
		"nonce":                 {nonce},
		"code_challenge":        {base64.RawURLEncoding.EncodeToString(sum[:])},
		"code_challenge_method": {"S256"},
	}
	return c.cfg.Issuer + authPath + "?" + q.Encode()
}

// Exchange swaps the code for tokens and returns the raw ID token.
func (c *Client) Exchange(ctx context.Context, code, verifier string) (string, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {c.cfg.RedirectURL},
		"client_id":     {c.cfg.ClientID},
		"client_secret": {c.cfg.ClientSecret},
		"code_verifier": {verifier},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.cfg.BackchannelURL+tokenPath, strings.NewReader(form.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	body, status, err := c.do(req)
	if err != nil {
		return "", err
	}
	if status != http.StatusOK {
		return "", fmt.Errorf("token endpoint answered %d", status)
	}
	var out struct {
		IDToken string `json:"id_token"`
	}
	if err := json.Unmarshal(body, &out); err != nil || out.IDToken == "" {
		return "", errors.New("token response has no id_token")
	}
	return out.IDToken, nil
}

func (c *Client) do(req *http.Request) ([]byte, int, error) {
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBodyBytes))
	return body, resp.StatusCode, err
}

// VerifyIDToken checks alg, signature, iss, aud/azp, exp and nonce.
func (c *Client) VerifyIDToken(ctx context.Context, raw, nonce string) (Claims, error) {
	parts := strings.Split(raw, ".")
	if len(parts) != 3 {
		return Claims{}, errors.New("malformed id token")
	}
	var header struct {
		Alg string `json:"alg"`
		Kid string `json:"kid"`
	}
	if err := decodePart(parts[0], &header); err != nil {
		return Claims{}, errors.New("malformed id token header")
	}
	if header.Alg != algPS256 {
		return Claims{}, errors.New("id token algorithm is not PS256")
	}
	key, err := c.key(ctx, header.Kid)
	if err != nil {
		return Claims{}, err
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return Claims{}, errors.New("malformed id token signature")
	}
	digest := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPSS(key, crypto.SHA256, digest[:], sig, &rsa.PSSOptions{SaltLength: rsa.PSSSaltLengthEqualsHash}); err != nil {
		return Claims{}, errors.New("id token signature is invalid")
	}

	var p struct {
		Iss               string          `json:"iss"`
		Aud               json.RawMessage `json:"aud"`
		Azp               string          `json:"azp"`
		Exp               int64           `json:"exp"`
		Nonce             string          `json:"nonce"`
		Sub               string          `json:"sub"`
		PreferredUsername string          `json:"preferred_username"`
		FynkSub           string          `json:"fynk_sub"`
	}
	if err := decodePart(parts[1], &p); err != nil {
		return Claims{}, errors.New("malformed id token payload")
	}
	if p.Iss != c.cfg.Issuer {
		return Claims{}, errors.New("id token issuer mismatch")
	}
	aud := audiences(p.Aud)
	if !contains(aud, c.cfg.ClientID) || (len(aud) > 1 && p.Azp != c.cfg.ClientID) {
		return Claims{}, errors.New("id token audience mismatch")
	}
	if p.Exp <= c.cfg.Now().Unix() {
		return Claims{}, errors.New("id token expired")
	}
	if nonce == "" || p.Nonce != nonce {
		return Claims{}, errors.New("id token nonce mismatch")
	}
	if p.Sub == "" {
		return Claims{}, errors.New("id token has no subject")
	}
	return Claims{Subject: p.Sub, PreferredUsername: p.PreferredUsername, FynkSub: p.FynkSub}, nil
}

func decodePart(part string, v any) error {
	b, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func audiences(raw json.RawMessage) []string {
	var one string
	if json.Unmarshal(raw, &one) == nil {
		return []string{one}
	}
	var many []string
	_ = json.Unmarshal(raw, &many)
	return many
}

func contains(list []string, want string) bool {
	for _, s := range list {
		if s == want {
			return true
		}
	}
	return false
}

// key returns the realm key for kid. An unknown kid refetches the key set once.
func (c *Client) key(ctx context.Context, kid string) (*rsa.PublicKey, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if k, ok := c.keys[kid]; ok {
		return k, nil
	}
	if err := c.refreshLocked(ctx); err != nil {
		return nil, err
	}
	if k, ok := c.keys[kid]; ok {
		return k, nil
	}
	return nil, errors.New("id token key id is unknown")
}

func (c *Client) refreshLocked(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.cfg.BackchannelURL+certsPath, nil)
	if err != nil {
		return err
	}
	body, status, err := c.do(req)
	if err != nil {
		return err
	}
	if status != http.StatusOK {
		return fmt.Errorf("jwks endpoint answered %d", status)
	}
	var set struct {
		Keys []struct {
			Kid string `json:"kid"`
			Kty string `json:"kty"`
			Use string `json:"use"`
			N   string `json:"n"`
			E   string `json:"e"`
		} `json:"keys"`
	}
	if err := json.Unmarshal(body, &set); err != nil {
		return errors.New("jwks is not valid JSON")
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range set.Keys {
		if k.Kty != "RSA" || (k.Use != "" && k.Use != "sig") {
			continue
		}
		n, errN := base64.RawURLEncoding.DecodeString(k.N)
		e, errE := base64.RawURLEncoding.DecodeString(k.E)
		if errN != nil || errE != nil || len(n) == 0 || len(e) == 0 {
			continue
		}
		keys[k.Kid] = &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
	}
	c.keys = keys
	return nil
}
