// Package bankdemo is the ports.Provider adapter for the simulated bank of M16
// (contracts/bank-simulator.yaml). One simulator serves two providers: Banco Demo (savings,
// credit card and CDT) and Billetera Demo (the wallet), so each adapter keeps only its accounts.
// Every call goes through the Caddy egress, which adds Fynk's mTLS client certificate.
package bankdemo

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

const (
	assertionType = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
	pageSize      = 200 // the simulator's maximum
	maxBody       = 4 << 20
)

// bogota is Colombia's time zone (UTC-5 all year), fixed so the binary needs no tz database.
var bogota = time.FixedZone("America/Bogota", -5*60*60)

// Config of one adapter.
type Config struct {
	Provider     string // 'banco-demo' or 'billetera-demo'
	BaseURL      string // <EGRESS_URL>/banco-demo
	ClientID     string // Fynk's client at the bank
	Audience     string // the bank's issuer, the aud of the client assertion
	AuthorizeURL string // the bank's authorization endpoint, opened in the phone's browser
	RedirectURI  string // fynk://bank/callback
	Signer       ports.AssertionSigner
	HTTP         *http.Client // from egress.NewClient
	Clock        clock.Clock
}

// Adapter implements ports.Provider.
type Adapter struct {
	cfg   Config
	keeps func(accountType string) bool
	label func(ports.AccountKind) string
}

var _ ports.Provider = (*Adapter)(nil)

// New returns the adapter of cfg.Provider.
func New(cfg Config) (*Adapter, error) {
	info, ok := ports.Lookup(cfg.Provider)
	if !ok || (cfg.Provider != "banco-demo" && cfg.Provider != "billetera-demo") {
		return nil, fmt.Errorf("bankdemo: %q is not served by the simulator", cfg.Provider)
	}
	a := &Adapter{cfg: cfg}
	if cfg.Provider == "billetera-demo" {
		a.keeps = func(t string) bool { return t == "WALLET" }
		a.label = func(ports.AccountKind) string { return info.DisplayName }
	} else {
		a.keeps = func(t string) bool { return t != "WALLET" }
		a.label = func(k ports.AccountKind) string { return info.DisplayName + " · " + kindLabels[k] }
	}
	return a, nil
}

// kindLabels name a bank account in the shared displayName ('Banco Demo · Ahorros').
var kindLabels = map[ports.AccountKind]string{
	ports.AccountSavings:    "Ahorros",
	ports.AccountChecking:   "Corriente",
	ports.AccountCreditCard: "Tarjeta de crédito",
	ports.AccountCDT:        "CDT",
}

// ID implements ports.Provider.
func (a *Adapter) ID() string { return a.cfg.Provider }

// PushAuthorization implements ports.Provider: a PAR (RFC 9126) with PKCE S256 and
// private_key_jwt. Only client_id and request_uri travel in the authorize URL.
func (a *Adapter) PushAuthorization(ctx context.Context, r ports.PARRequest) (ports.PARResult, error) {
	form := url.Values{
		"response_type":         {"code"},
		"redirect_uri":          {r.RedirectURI},
		"scope":                 {bankScope(r.Scopes)},
		"code_challenge":        {r.CodeChallenge},
		"code_challenge_method": {"S256"},
		"state":                 {r.State},
		"nonce":                 {r.Nonce},
		"fynk_consent_id":       {r.ConsentID},
	}
	var out struct {
		RequestURI string `json:"request_uri"`
		ExpiresIn  int    `json:"expires_in"`
	}
	if err := a.oauth(ctx, "/oauth/par", form, &out); err != nil {
		return ports.PARResult{}, err
	}
	if out.RequestURI == "" {
		return ports.PARResult{}, fmt.Errorf("bankdemo: par without request_uri: %w", ports.ErrProviderUnavailable)
	}
	q := url.Values{"client_id": {a.cfg.ClientID}, "request_uri": {out.RequestURI}}
	return ports.PARResult{
		AuthorizeURL: a.cfg.AuthorizeURL + "?" + q.Encode(),
		ExpiresIn:    time.Duration(out.ExpiresIn) * time.Second,
	}, nil
}

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

func (a *Adapter) token(ctx context.Context, form url.Values) (ports.TokenSet, error) {
	var out struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		ConsentID    string `json:"consent_id"`
	}
	if err := a.oauth(ctx, "/oauth/token", form, &out); err != nil {
		return ports.TokenSet{}, err
	}
	if out.AccessToken == "" {
		return ports.TokenSet{}, fmt.Errorf("bankdemo: token answer without access_token: %w", ports.ErrProviderUnavailable)
	}
	return ports.TokenSet{
		AccessToken:       out.AccessToken,
		RefreshToken:      out.RefreshToken,
		ExpiresIn:         time.Duration(out.ExpiresIn) * time.Second,
		ProviderConsentID: out.ConsentID,
	}, nil
}

// Accounts implements ports.Provider.
func (a *Adapter) Accounts(ctx context.Context, accessToken string) ([]ports.Account, error) {
	var out struct {
		Data []bankAccount `json:"data"`
	}
	if err := a.get(ctx, "/open-finance/v1/accounts", accessToken, &out); err != nil {
		return nil, err
	}
	today := a.cfg.Clock.Now().In(bogota)
	accounts := make([]ports.Account, 0, len(out.Data))
	for _, b := range out.Data {
		if !a.keeps(b.Type) {
			continue
		}
		acc, ok, err := b.toPort(today)
		if err != nil {
			return nil, fmt.Errorf("bankdemo: account: %w", err)
		}
		if !ok {
			continue // a product Fynk does not show yet
		}
		acc.DisplayName = a.label(acc.Kind)
		accounts = append(accounts, acc)
	}
	return accounts, nil
}

// Transactions implements ports.Provider: one page, newest first.
func (a *Adapter) Transactions(ctx context.Context, accessToken, accountID string, since time.Time, cursor string) (ports.TxPage, error) {
	q := url.Values{"fromBookingDate": {since.UTC().Format(time.RFC3339)}, "pageSize": {strconv.Itoa(pageSize)}}
	if cursor != "" {
		q.Set("cursor", cursor)
	}
	var out struct {
		Data []bankTransaction `json:"data"`
		Meta struct {
			HasMore    bool    `json:"hasMore"`
			NextCursor *string `json:"nextCursor"`
		} `json:"meta"`
	}
	path := "/open-finance/v1/accounts/" + url.PathEscape(accountID) + "/transactions?" + q.Encode()
	if err := a.get(ctx, path, accessToken, &out); err != nil {
		return ports.TxPage{}, err
	}
	page := ports.TxPage{Items: make([]ports.Transaction, 0, len(out.Data))}
	for _, b := range out.Data {
		page.Items = append(page.Items, b.toPort())
	}
	if out.Meta.HasMore && out.Meta.NextCursor != nil {
		page.NextCursor = *out.Meta.NextCursor
	}
	return page, nil
}

// RevokeConsent implements ports.Provider: a client credentials token, then DELETE of the
// bank's consent. A consent the bank no longer knows has nothing left to revoke.
func (a *Adapter) RevokeConsent(ctx context.Context, providerConsentID string) error {
	cc, err := a.token(ctx, url.Values{"grant_type": {"client_credentials"}})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete,
		a.cfg.BaseURL+"/open-finance/v1/consents/"+url.PathEscape(providerConsentID), nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+cc.AccessToken)
	res, err := a.cfg.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("bankdemo: revoke: %w", errors.Join(ports.ErrProviderUnavailable, err))
	}
	defer drain(res)
	if res.StatusCode == http.StatusNoContent || res.StatusCode == http.StatusOK || res.StatusCode == http.StatusNotFound {
		return nil
	}
	return resourceError("revoke", res)
}

// Products implements ports.Provider: the public CDT catalog, without a user token.
func (a *Adapter) Products(ctx context.Context) ([]ports.Product, error) {
	var out struct {
		Data []struct {
			ID             string `json:"id"`
			Name           string `json:"name"`
			TermDays       int    `json:"termDays"`
			RateEaBps      int    `json:"rateEaBps"`
			MinAmountMinor int64  `json:"minAmountMinor"`
			Risk           string `json:"risk"`
		} `json:"data"`
	}
	if err := a.get(ctx, "/open-finance/v1/products/cdt", "", &out); err != nil {
		return nil, err
	}
	products := make([]ports.Product, 0, len(out.Data))
	for _, p := range out.Data {
		products = append(products, ports.Product{ID: p.ID, Name: p.Name, TermDays: p.TermDays,
			RateEaBps: p.RateEaBps, MinAmountMinor: p.MinAmountMinor, Risk: p.Risk})
	}
	return products, nil
}

// oauth posts form to an OAuth endpoint with private_key_jwt and decodes the JSON answer.
func (a *Adapter) oauth(ctx context.Context, path string, form url.Values, out any) error {
	assertion, err := a.cfg.Signer.ClientAssertion(ctx, a.cfg.Audience)
	if err != nil {
		return fmt.Errorf("bankdemo: client assertion: %w", err)
	}
	form.Set("client_id", a.cfg.ClientID)
	form.Set("client_assertion_type", assertionType)
	form.Set("client_assertion", assertion)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.cfg.BaseURL+path, strings.NewReader(form.Encode()))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")
	res, err := a.cfg.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("bankdemo: %s: %w", path, errors.Join(ports.ErrProviderUnavailable, err))
	}
	defer drain(res)
	if res.StatusCode/100 != 2 {
		var e struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(io.LimitReader(res.Body, maxBody)).Decode(&e)
		if e.Error == "invalid_grant" {
			return fmt.Errorf("bankdemo: %s: %w", path, ports.ErrInvalidGrant)
		}
		// invalid_client and the rest are Fynk's or the bank's setup, not the user's doing.
		return fmt.Errorf("bankdemo: %s: status %d (%s): %w", path, res.StatusCode, e.Error, ports.ErrProviderUnavailable)
	}
	return decode(res, out)
}

// get calls a resource endpoint, with the user's token when there is one.
func (a *Adapter) get(ctx context.Context, path, accessToken string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.cfg.BaseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	if accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}
	res, err := a.cfg.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("bankdemo: %s: %w", endpoint(path), errors.Join(ports.ErrProviderUnavailable, err))
	}
	defer drain(res)
	if res.StatusCode != http.StatusOK {
		return resourceError(endpoint(path), res)
	}
	return decode(res, out)
}

// resourceError maps a resource answer to a port error. The bank's text is never kept: it
// could carry data, and the redacting logger does not look inside messages.
func resourceError(what string, res *http.Response) error {
	switch res.StatusCode {
	case http.StatusForbidden:
		return fmt.Errorf("bankdemo: %s: %w", what, ports.ErrConsentRevoked)
	case http.StatusUnauthorized:
		return fmt.Errorf("bankdemo: %s: %w", what, ports.ErrInvalidGrant)
	case http.StatusTooManyRequests:
		secs, err := strconv.Atoi(res.Header.Get("Retry-After"))
		if err != nil || secs < 1 {
			secs = 60
		}
		return fmt.Errorf("bankdemo: %s: %w", what, &ports.RateLimitedError{RetryAfter: time.Duration(secs) * time.Second})
	default:
		return fmt.Errorf("bankdemo: %s: status %d: %w", what, res.StatusCode, ports.ErrProviderUnavailable)
	}
}

func decode(res *http.Response, out any) error {
	if err := json.NewDecoder(io.LimitReader(res.Body, maxBody)).Decode(out); err != nil {
		return fmt.Errorf("bankdemo: decode answer: %w", errors.Join(ports.ErrProviderUnavailable, err))
	}
	return nil
}

func drain(res *http.Response) {
	_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, maxBody))
	_ = res.Body.Close()
}

// endpoint names a resource path without its ids or query, for error messages.
func endpoint(path string) string {
	switch {
	case strings.Contains(path, "/transactions"):
		return "transactions"
	case strings.Contains(path, "/products"):
		return "products"
	default:
		return "accounts"
	}
}

// bankScope maps Fynk's consent scopes to the simulator's: Saldos and Datos de la cuenta are
// both "accounts", Movimientos is "transactions".
func bankScope(scopes []ports.Scope) string {
	var accounts, transactions bool
	for _, s := range scopes {
		switch s {
		case ports.ScopeBalances, ports.ScopeAccountDetails:
			accounts = true
		case ports.ScopeTransactions:
			transactions = true
		}
	}
	var out []string
	if accounts {
		out = append(out, "accounts")
	}
	if transactions {
		out = append(out, "transactions")
	}
	return strings.Join(out, " ")
}
