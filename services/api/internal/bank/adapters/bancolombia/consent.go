package bancolombia

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

// PushAuthorization implements ports.Provider. Bancolombia's order (Open Banking Authorization):
// a client credentials token, the account access consent with the scopes the person accepted
// and its term, then the PAR with that consent id in the scope, PKCE S256 and private_key_jwt.
func (a *Adapter) PushAuthorization(ctx context.Context, r ports.PARRequest) (ports.PARResult, error) {
	cc, err := a.token(ctx, url.Values{"grant_type": {"client_credentials"}})
	if err != nil {
		return ports.PARResult{}, err
	}
	consentID, err := a.createConsent(ctx, cc.AccessToken, r)
	if err != nil {
		return ports.PARResult{}, err
	}
	form := url.Values{
		"client_id":             {a.cfg.ClientID},
		"redirect_uri":          {r.RedirectURI},
		"scope":                 {"openid accounts " + consentID},
		"state":                 {r.State},
		"response_type":         {"code"},
		"code_challenge":        {r.CodeChallenge},
		"code_challenge_method": {"S256"},
	}
	var out struct {
		RequestURI string `json:"request_uri"`
		ExpiresIn  int    `json:"expires_in"`
	}
	if err := a.oauth(ctx, "/par", form, &out); err != nil {
		return ports.PARResult{}, err
	}
	if out.RequestURI == "" {
		return ports.PARResult{}, fmt.Errorf("bancolombia: par without request_uri: %w", ports.ErrProviderUnavailable)
	}
	q := url.Values{"client_id": {a.cfg.ClientID}, "request_uri": {out.RequestURI}}
	return ports.PARResult{
		AuthorizeURL:      a.cfg.AuthorizeURL + "?" + q.Encode(),
		ExpiresIn:         time.Duration(out.ExpiresIn) * time.Second,
		ProviderConsentID: consentID,
	}, nil
}

// permissions maps Fynk's consent scopes to Bancolombia's: Datos de la cuenta, Saldos and
// Movimientos.
func permissions(scopes []ports.Scope) []string {
	var out []string
	for _, s := range scopes {
		switch s {
		case ports.ScopeAccountDetails:
			out = append(out, "ReadAccountsBasic")
		case ports.ScopeBalances:
			out = append(out, "ReadBalances")
		case ports.ScopeTransactions:
			out = append(out, "ReadTransactionsDetail")
		}
	}
	return out
}

// createConsent registers the access the person accepted: the same scopes and term as M4's
// consent. Bancolombia gives at most 90 days of movements, its default.
func (a *Adapter) createConsent(ctx context.Context, ccToken string, r ports.PARRequest) (string, error) {
	perms := permissions(r.Scopes)
	if len(perms) == 0 {
		return "", fmt.Errorf("bancolombia: consent without scopes: %w", ports.ErrProviderUnavailable)
	}
	type owner struct {
		Name           string `json:"Name,omitempty"`
		SchemeName     string `json:"SchemeName"`
		Identification string `json:"Identification"`
	}
	var body struct {
		Data struct {
			Permissions        []string `json:"Permissions"`
			ExpirationDateTime string   `json:"ExpirationDateTime,omitempty"`
			AccountOwner       owner    `json:"AccountOwner"`
		} `json:"Data"`
	}
	body.Data.Permissions = perms
	if r.TermDays > 0 {
		body.Data.ExpirationDateTime = a.cfg.Clock.Now().UTC().AddDate(0, 0, r.TermDays).Format(time.RFC3339)
	}
	body.Data.AccountOwner = owner{Name: a.cfg.Owner.Name, SchemeName: a.cfg.Owner.IDType, Identification: a.cfg.Owner.ID}
	payload, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	var out struct {
		Data struct {
			ConsentID string `json:"ConsentId"`
		} `json:"Data"`
	}
	if err := a.resource(ctx, http.MethodPost, depositsPath+"/accounts/account-access-consent", ccToken, payload, &out); err != nil {
		return "", err
	}
	if out.Data.ConsentID == "" {
		return "", fmt.Errorf("bancolombia: consent without ConsentId: %w", ports.ErrProviderUnavailable)
	}
	return out.Data.ConsentID, nil
}

// resource calls an Account Information API with a bearer token and the FAPI headers.
func (a *Adapter) resource(ctx context.Context, method, path, token string, body []byte, out any) error {
	var reader io.Reader
	if body != nil {
		reader = strings.NewReader(string(body))
	}
	req, err := http.NewRequestWithContext(ctx, method, a.cfg.ResourceBaseURL+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-fapi-interaction-id", newID())
	req.Header.Set("x-fapi-financial-id", newID())
	a.credentials(req)
	res, err := a.cfg.HTTP.Do(req)
	what := endpoint(path)
	if err != nil {
		return fmt.Errorf("bancolombia: %s: %w", what, errors.Join(ports.ErrProviderUnavailable, err))
	}
	defer drain(res)
	if res.StatusCode != http.StatusOK && res.StatusCode != http.StatusCreated {
		return resourceError(what, res)
	}
	return decode(res, out)
}

// resourceError maps an Account Information answer (Code and ErrorCode in ISO 20022 style).
// 403 is a consent that expired or was revoked at the bank; 404 NAUT a consent the bank does
// not know. The bank's text is never kept.
func resourceError(what string, res *http.Response) error {
	switch res.StatusCode {
	case http.StatusUnauthorized:
		// invalid_client: the gateway refused Fynk's mTLS certificate or API Market credentials.
		// Fynk's setup is wrong, the person's consent is fine, so nobody is asked to reconnect.
		var body struct {
			Error string `json:"error"`
		}
		_ = json.NewDecoder(io.LimitReader(res.Body, maxBody)).Decode(&body)
		if body.Error == "invalid_client" {
			return fmt.Errorf("bancolombia: %s: invalid_client, check the mTLS certificate and credentials: %w",
				what, ports.ErrProviderUnavailable)
		}
		return fmt.Errorf("bancolombia: %s: %w", what, ports.ErrInvalidGrant)
	case http.StatusForbidden:
		return fmt.Errorf("bancolombia: %s: %w", what, ports.ErrConsentRevoked)
	case http.StatusTooManyRequests:
		return rateLimited(what, res)
	case http.StatusNotFound:
		var body struct {
			Code string `json:"Code"`
		}
		_ = json.NewDecoder(io.LimitReader(res.Body, maxBody)).Decode(&body)
		switch body.Code {
		case "NAUT":
			return fmt.Errorf("bancolombia: %s: %w", what, ports.ErrConsentRevoked)
		case "X050":
			return fmt.Errorf("bancolombia: %s: %w", what, errNoData)
		}
	}
	return fmt.Errorf("bancolombia: %s: status %d: %w", what, res.StatusCode, ports.ErrProviderUnavailable)
}

// errNoData: the account has no movements in the range (404 X050). An empty page, not a failure.
var errNoData = errors.New("bancolombia: no data")

// endpoint names a resource path without its ids or query, for error messages.
func endpoint(path string) string {
	switch {
	case strings.Contains(path, "account-access-consent"):
		return "consent"
	case strings.Contains(path, "/transactions"):
		return "transactions"
	case strings.Contains(path, "/balances"):
		return "balances"
	default:
		return "accounts"
	}
}

// newID is a random UUID v4 for the x-fapi-* headers.
func newID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	h := hex.EncodeToString(b[:])
	return h[:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:]
}
