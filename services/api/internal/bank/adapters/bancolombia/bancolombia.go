// Package bancolombia is the ports.Provider adapter for Bancolombia's Open Finance APIs
// (Circular Externa 004 de 2024, FAPI 2.0), as documented in its API Market sandbox:
// Open Banking Authorization (token, PAR) and Account Information (consents, accounts,
// balances, transactions). See docs/adr/0003-bancolombia-sandbox.md.
//
// The link flow differs from Banco Demo in one step: Bancolombia's consent is created first,
// with a client credentials token, and its id travels in the PAR's scope. Its consent API asks
// for the customer's ID document (AccountOwner), which Fynk never asks (CLAUDE.md, rule 10), so
// the adapter only runs with the sandbox's fictional customer from the settings.
//
// Every call goes through the Caddy egress, which adds Fynk's mTLS client certificate.
package bancolombia

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// ID is the provider id of Bancolombia in Fynk.
const ID = "bancolombia"

const (
	assertionType = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
	// tokenScope is the scope of every token request. The token API lists payment, account and
	// openid; the PAR and resource docs say "accounts". The sandbox test settles it.
	tokenScope = "account"
	// depositsPath is the base path of the Account Information APIs.
	depositsPath = "/open-banking/v1/deposits"
	maxBody      = 4 << 20
)

// Owner is the customer the consent is created for (AccountOwner). Only the sandbox's
// fictional customer: Fynk never asks a person for their document.
type Owner struct {
	IDType string // CC, CE, PA...
	ID     string
	Name   string
}

// Config of the adapter.
type Config struct {
	AuthBaseURL     string // <EGRESS_URL>/bancolombia-auth: token and PAR
	ResourceBaseURL string // <EGRESS_URL>/bancolombia-api: consents, accounts, transactions
	ClientID        string // Fynk's application in the API Market (also the Client-Id header)
	ClientSecret    string // the Client-Secret header of the API Market. Never logged
	Audience        string // Bancolombia's issuer, the aud of the client assertion
	AuthorizeURL    string // Bancolombia's authorization endpoint, opened in the phone's browser
	Owner           Owner  // the sandbox's fictional customer
	Sandbox         bool   // fictional data: the app shows "Simulado"
	Signer          ports.AssertionSigner
	HTTP            *http.Client // from egress.NewClient
	Clock           clock.Clock
}

// ErrNoOwner: the consent API needs the customer's document and only the sandbox's is known.
var ErrNoOwner = errors.New("bancolombia: the consent API needs the customer's ID document; only the sandbox customer is configured")

// Adapter implements ports.Provider.
type Adapter struct{ cfg Config }

var _ ports.Provider = (*Adapter)(nil)

// New returns the adapter, or ErrNoOwner outside the sandbox.
func New(cfg Config) (*Adapter, error) {
	if !cfg.Sandbox || cfg.Owner.ID == "" || cfg.Owner.IDType == "" {
		return nil, ErrNoOwner
	}
	if cfg.ClientID == "" || cfg.ClientSecret == "" || cfg.AuthBaseURL == "" || cfg.ResourceBaseURL == "" ||
		cfg.Audience == "" || cfg.AuthorizeURL == "" || cfg.Signer == nil || cfg.HTTP == nil || cfg.Clock == nil {
		return nil, errors.New("bancolombia: missing settings")
	}
	return &Adapter{cfg: cfg}, nil
}

// ID implements ports.Provider.
func (a *Adapter) ID() string { return ID }

// ExchangeCode implements ports.Provider.
func (a *Adapter) ExchangeCode(ctx context.Context, r ports.CodeExchange) (ports.TokenSet, error) {
	return a.token(ctx, url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {r.Code},
		"code_verifier": {r.CodeVerifier},
		"redirect_uri":  {r.RedirectURI},
	})
}

// Refresh implements ports.Provider.
func (a *Adapter) Refresh(ctx context.Context, refreshToken string) (ports.TokenSet, error) {
	return a.token(ctx, url.Values{"grant_type": {"refresh_token"}, "refresh_token": {refreshToken}})
}

// RevokeConsent implements ports.Provider. Bancolombia's sandbox documents no API for a third
// party to revoke an account access consent (only token revocation, which needs the person's
// token, kept on the phone). M4 stops trying at once (ADR 0003).
func (a *Adapter) RevokeConsent(context.Context, string) error {
	return fmt.Errorf("bancolombia: revoke consent: %w", ports.ErrRevocationNotSupported)
}

// Products implements ports.Provider: Bancolombia's CDTs are not in its Open Finance APIs.
func (a *Adapter) Products(context.Context) ([]ports.Product, error) { return nil, nil }

func (a *Adapter) token(ctx context.Context, form url.Values) (ports.TokenSet, error) {
	form.Set("scope", tokenScope)
	var out struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := a.oauth(ctx, "/token", form, &out); err != nil {
		return ports.TokenSet{}, err
	}
	if out.AccessToken == "" {
		return ports.TokenSet{}, fmt.Errorf("bancolombia: token answer without access_token: %w", ports.ErrProviderUnavailable)
	}
	return ports.TokenSet{
		AccessToken:  out.AccessToken,
		RefreshToken: out.RefreshToken,
		ExpiresIn:    time.Duration(out.ExpiresIn) * time.Second,
	}, nil
}

// oauth posts form to an authorization endpoint with private_key_jwt and the API Market
// credentials, and decodes the JSON answer.
func (a *Adapter) oauth(ctx context.Context, path string, form url.Values, out any) error {
	assertion, err := a.cfg.Signer.ClientAssertion(ctx, a.cfg.Audience)
	if err != nil {
		return fmt.Errorf("bancolombia: client assertion: %w", err)
	}
	form.Set("client_assertion_type", assertionType)
	form.Set("client_assertion", assertion)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.cfg.AuthBaseURL+path, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	a.credentials(req)
	res, err := a.cfg.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("bancolombia: %s: %w", strings.TrimPrefix(path, "/"), errors.Join(ports.ErrProviderUnavailable, err))
	}
	defer drain(res)
	if res.StatusCode != http.StatusOK {
		return oauthError(strings.TrimPrefix(path, "/"), res)
	}
	return decode(res, out)
}

// credentials adds the API Market's application headers.
func (a *Adapter) credentials(req *http.Request) {
	req.Header.Set("Client-Id", a.cfg.ClientID)
	req.Header.Set("Client-Secret", a.cfg.ClientSecret)
}

// oauthError maps an authorization server answer. invalid_grant means the code or the refresh
// token is no longer good: the person has to connect again.
func oauthError(what string, res *http.Response) error {
	if res.StatusCode == http.StatusTooManyRequests {
		return rateLimited(what, res)
	}
	if res.StatusCode == http.StatusBadRequest || res.StatusCode == http.StatusUnauthorized {
		var body struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(io.LimitReader(res.Body, maxBody)).Decode(&body)
		if body.Error == "invalid_grant" {
			return fmt.Errorf("bancolombia: %s: %w", what, ports.ErrInvalidGrant)
		}
	}
	return fmt.Errorf("bancolombia: %s: status %d: %w", what, res.StatusCode, ports.ErrProviderUnavailable)
}

func rateLimited(what string, res *http.Response) error {
	secs, err := strconv.Atoi(res.Header.Get("Retry-After"))
	if err != nil || secs < 1 {
		secs = 60
	}
	return fmt.Errorf("bancolombia: %s: %w", what, &ports.RateLimitedError{RetryAfter: time.Duration(secs) * time.Second})
}

func decode(res *http.Response, out any) error {
	if err := json.NewDecoder(io.LimitReader(res.Body, maxBody)).Decode(out); err != nil {
		return fmt.Errorf("bancolombia: decode answer: %w", errors.Join(ports.ErrProviderUnavailable, err))
	}
	return nil
}

func drain(res *http.Response) {
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, maxBody))
	_ = res.Body.Close()
}
