package service

import (
	"context"
	"errors"
	"strconv"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/keys"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/link"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
)

// Limits of the bank proxy (M5 prompt, CLAUDE.md Security rules).
const (
	QueriesPerMinute = 30
	NonceTTL         = 5 * time.Minute
	MinNonceLength   = 16
)

// More errors of the bank proxy.
var (
	ErrLinkNotFound    = &Error{404, "link_not_found", "The link does not exist."}
	ErrConsentRevoked  = &Error{409, "consent_revoked", "The consent for this bank was revoked or expired."}
	ErrRefreshMismatch = &Error{409, "refresh_token_mismatch", "The refresh token is not this link's current one."}
	ErrNonceRequired   = &Error{400, "nonce_required", "Every bank request needs a new X-Request-Nonce of 16 to 128 characters."}
	ErrReplayed        = &Error{409, "replayed_request", "This request was already received."}
)

// RateLimited: too many bank queries, from Fynk's own limit or the bank's. Answered as 429.
type RateLimited struct {
	RetryAfter time.Duration
}

func (e *RateLimited) Error() string { return "rate_limited" }

// CheckNonce refuses a request whose X-Request-Nonce the user already sent in the last
// 5 minutes (replay protection).
func (s *Service) CheckNonce(ctx context.Context, u User, nonce string) error {
	if len(nonce) < MinNonceLength || len(nonce) > 128 {
		return ErrNonceRequired
	}
	fresh, err := s.d.Nonces.FirstUse(ctx, u.ID, nonce, NonceTTL)
	if err != nil {
		return err
	}
	if !fresh {
		return ErrReplayed
	}
	return nil
}

// usableLink runs the checks before every bank call: a trusted device, the user's rate limit,
// the link belongs to the user and the device and is active, and the consent is still active.
// When the consent ended, the link ends too, and the answer is 409 consent_revoked (HU-008).
func (s *Service) usableLink(ctx context.Context, u User, linkID string) (link.Link, ports.Provider, error) {
	if u.DeviceID == "" {
		return link.Link{}, nil, ErrDeviceRequired
	}
	ok, retry, err := s.d.Limiter.Allow(ctx, u.ID, QueriesPerMinute, time.Minute)
	if err != nil {
		return link.Link{}, nil, err
	}
	if !ok {
		return link.Link{}, nil, &RateLimited{RetryAfter: retry}
	}
	l, err := s.d.Links.Get(ctx, linkID)
	if errors.Is(err, link.ErrNotFound) {
		return link.Link{}, nil, ErrLinkNotFound
	}
	if err != nil {
		return link.Link{}, nil, err
	}
	switch err := l.UsableBy(u.ID, u.DeviceID); {
	case errors.Is(err, link.ErrNotFound):
		return link.Link{}, nil, ErrLinkNotFound
	case errors.Is(err, link.ErrRevoked):
		return link.Link{}, nil, ErrConsentRevoked
	}
	active, err := s.d.Consents.Active(ctx, u.ID, l.ConsentID)
	if err != nil {
		return link.Link{}, nil, err
	}
	if !active {
		return link.Link{}, nil, s.endLink(ctx, l)
	}
	p, ok := s.provider(l.Provider)
	if !ok {
		return link.Link{}, nil, ports.ErrProviderUnavailable
	}
	return l, p, nil
}

func (s *Service) endLink(ctx context.Context, l link.Link) error {
	if err := s.d.Links.Revoke(ctx, l.ID, s.d.Clock.Now()); err != nil {
		return err
	}
	return ErrConsentRevoked
}

// bankError turns the bank's answer into the proxy's, and audits the failure.
func (s *Service) bankError(ctx context.Context, u User, l link.Link, err error) error {
	var limited *ports.RateLimitedError
	switch {
	case errors.As(err, &limited):
		err = &RateLimited{RetryAfter: limited.RetryAfter}
	case errors.Is(err, ports.ErrConsentRevoked):
		err = s.endLink(ctx, l)
	}
	s.record(ctx, audit.Event{
		Type: audit.BankSyncFailed, UserID: u.ID, DeviceID: u.DeviceID, At: s.d.Clock.Now(),
		Meta: map[string]string{"provider": l.Provider, "error_code": codeOf(err), "status": "failed"},
	})
	return err
}

// codeOf is the stable code of a proxy error, for the audit.
func codeOf(err error) string {
	var rule *Error
	var bank *ports.Error
	switch {
	case isRateLimited(err):
		return "rate_limited"
	case errors.As(err, &rule):
		return rule.Code
	case errors.As(err, &bank):
		return bank.Code
	}
	return "internal"
}

func isRateLimited(err error) bool {
	var r *RateLimited
	return errors.As(err, &r)
}

// Accounts returns the accounts the bank shares under the link's consent.
func (s *Service) Accounts(ctx context.Context, u User, linkID, accessToken string) ([]ports.Account, error) {
	l, p, err := s.usableLink(ctx, u, linkID)
	if err != nil {
		return nil, err
	}
	accounts, err := p.Accounts(ctx, accessToken)
	if err != nil {
		return nil, s.bankError(ctx, u, l, err)
	}
	s.record(ctx, audit.Event{
		Type: audit.BankSync, UserID: u.ID, DeviceID: u.DeviceID, At: s.d.Clock.Now(),
		Meta: map[string]string{"provider": l.Provider, "accounts_count": strconv.Itoa(len(accounts)), "status": "ok"},
	})
	return accounts, nil
}

// Transactions returns one page of an account's movements since a date.
func (s *Service) Transactions(ctx context.Context, u User, linkID, accessToken, accountID string, since time.Time, cursor string) (ports.TxPage, error) {
	l, p, err := s.usableLink(ctx, u, linkID)
	if err != nil {
		return ports.TxPage{}, err
	}
	page, err := p.Transactions(ctx, accessToken, accountID, since, cursor)
	if err != nil {
		return ports.TxPage{}, s.bankError(ctx, u, l, err)
	}
	return page, nil
}

// Refresh renews the link's tokens. The refresh token must be the link's current one (its
// fingerprint), so a token from another user, another link or an older refresh is refused.
// The new fingerprint replaces the old one only if no other refresh got there first.
func (s *Service) Refresh(ctx context.Context, u User, linkID, refreshToken string) (Linked, error) {
	l, p, err := s.usableLink(ctx, u, linkID)
	if err != nil {
		return Linked{}, err
	}
	same, err := keys.Matches(ctx, s.d.Fingerprints, refreshToken, l.TokenFingerprint)
	if err != nil {
		return Linked{}, err
	}
	if !same {
		return Linked{}, ErrRefreshMismatch
	}
	tokens, err := p.Refresh(ctx, refreshToken)
	if err != nil {
		return Linked{}, s.bankError(ctx, u, l, err)
	}
	if tokens.RefreshToken == "" { // a bank that does not rotate refresh tokens
		tokens.RefreshToken = refreshToken
	}
	next, err := s.d.Fingerprints.Fingerprint(ctx, tokens.RefreshToken)
	if err != nil {
		return Linked{}, err
	}
	if err := s.d.Links.Rotate(ctx, l.ID, l.TokenFingerprint, next, s.d.Clock.Now()); err != nil {
		if errors.Is(err, link.ErrStale) {
			return Linked{}, ErrRefreshMismatch
		}
		return Linked{}, err
	}
	s.record(ctx, audit.Event{
		Type: audit.BankTokenRefreshed, UserID: u.ID, DeviceID: u.DeviceID, At: s.d.Clock.Now(),
		Meta: map[string]string{"provider": l.Provider, "status": "ok"},
	})
	return Linked{
		LinkID: l.ID, Provider: l.Provider, AccessToken: tokens.AccessToken,
		RefreshToken: tokens.RefreshToken, ExpiresIn: tokens.ExpiresIn,
	}, nil
}
