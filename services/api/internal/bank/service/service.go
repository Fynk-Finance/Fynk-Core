// Package service is the bank module's link logic (M5 step 2). It talks to banks only through
// ports.Provider, so it is the same for Banco Demo, Billetera Demo and any future bank: what is
// bank-specific lives in the adapters (CLAUDE.md, architecture rule 7). The API passes the bank
// tokens through and keeps only a fingerprint of the refresh token.
package service

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log/slog"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/keys"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/link"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/store"
	consentports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Error is a link failure with a stable problem code and its HTTP status.
type Error struct {
	Status int
	Code   string
	Detail string
}

func (e *Error) Error() string { return e.Code + ": " + e.Detail }

// Errors of the link endpoints. Details never hold personal data.
var (
	ErrDeviceRequired        = &Error{422, "device_required", "The X-Device-Id header with a registered device is required."}
	ErrProviderMismatch      = &Error{422, "provider_mismatch", "The consent was given for another entity."}
	ErrAuthorizationNotFound = &Error{404, "authorization_not_found", "The authorization is unknown, used or expired."}
	ErrConsentAlreadyLinked  = &Error{409, "consent_already_linked", "This consent already has a link."}
)

// Providers finds a working adapter by provider id.
type Providers interface {
	Provider(id string) (ports.Provider, bool)
}

// ProviderMap is Providers over a map, built once at startup.
type ProviderMap map[string]ports.Provider

// Provider implements Providers.
func (m ProviderMap) Provider(id string) (ports.Provider, bool) {
	p, ok := m[id]
	return p, ok
}

// Deps of the service.
type Deps struct {
	Providers      Providers
	Pending        consentports.PendingReader
	Consents       consentports.ConsentChecker
	Links          link.Store
	Authorizations store.Authorizations
	Fingerprints   keys.Fingerprinter
	Audit          audit.Recorder
	Clock          clock.Clock
	Log            *slog.Logger
	RedirectURI    string
}

// Service implements the link endpoints.
type Service struct {
	d Deps
}

// New returns the service.
func New(d Deps) *Service { return &Service{d: d} }

// User is who calls: the Keycloak subject and the trusted device (M1).
type User struct {
	ID       string
	DeviceID string
}

// StartRequest starts a link for one pending consent.
type StartRequest struct {
	Provider      string
	ConsentID     string
	CodeChallenge string // S256, made on the phone
	State         string // checked on the phone when the bank returns
}

// Started is what the phone opens in the system browser.
type Started struct {
	AuthorizationID string
	AuthorizeURL    string
	ExpiresAt       time.Time
}

// CreateAuthorization sends the pushed authorization request for the user's pending consent,
// with exactly the scopes, purpose and term the user accepted, and keeps it for 10 minutes.
func (s *Service) CreateAuthorization(ctx context.Context, u User, r StartRequest) (Started, error) {
	if u.DeviceID == "" {
		return Started{}, ErrDeviceRequired
	}
	consent, err := s.d.Pending.Pending(ctx, u.ID, r.ConsentID)
	if err != nil {
		return Started{}, err
	}
	if consent.Provider != r.Provider {
		return Started{}, ErrProviderMismatch
	}
	p, ok := s.provider(r.Provider)
	if !ok {
		return Started{}, ports.ErrProviderUnavailable
	}
	nonce, err := random()
	if err != nil {
		return Started{}, err
	}
	scopes := make([]ports.Scope, len(consent.Scopes))
	for i, sc := range consent.Scopes {
		scopes[i] = ports.Scope(sc)
	}
	par, err := p.PushAuthorization(ctx, ports.PARRequest{
		RedirectURI:   s.d.RedirectURI,
		Scopes:        scopes,
		CodeChallenge: r.CodeChallenge,
		State:         r.State,
		Nonce:         nonce,
		ConsentID:     consent.ID,
		Purpose:       consent.Purpose,
		TermDays:      consent.TermDays,
	})
	if err != nil {
		return Started{}, err
	}
	now := s.d.Clock.Now()
	ttl := link.AuthorizationTTL
	if par.ExpiresIn > 0 && par.ExpiresIn < ttl {
		ttl = par.ExpiresIn
	}
	a := link.Authorization{
		ID: NewID(now), UserID: u.ID, DeviceID: u.DeviceID, ConsentID: consent.ID,
		Provider: r.Provider, RedirectURI: s.d.RedirectURI, ExpiresAt: now.Add(ttl),
	}
	if err := s.d.Authorizations.Save(ctx, a, ttl); err != nil {
		return Started{}, err
	}
	return Started{AuthorizationID: a.ID, AuthorizeURL: par.AuthorizeURL, ExpiresAt: a.ExpiresAt}, nil
}

// Linked is the answer of an exchange. The tokens go to the phone and are never stored here.
type Linked struct {
	LinkID       string
	Provider     string
	AccessToken  string
	RefreshToken string
	ExpiresIn    time.Duration
}

// Exchange trades the code for the bank tokens with PKCE, marks the consent granted (M4),
// stores the link with the refresh token's fingerprint, and returns the tokens.
func (s *Service) Exchange(ctx context.Context, u User, authorizationID, code, verifier string) (Linked, error) {
	if u.DeviceID == "" {
		return Linked{}, ErrDeviceRequired
	}
	a, err := s.d.Authorizations.Take(ctx, authorizationID)
	if errors.Is(err, link.ErrAuthorizationNotFound) {
		return Linked{}, ErrAuthorizationNotFound
	}
	if err != nil {
		return Linked{}, err
	}
	if a.UserID != u.ID || a.DeviceID != u.DeviceID || !s.d.Clock.Now().Before(a.ExpiresAt) {
		return Linked{}, ErrAuthorizationNotFound
	}
	p, ok := s.provider(a.Provider)
	if !ok {
		return Linked{}, ports.ErrProviderUnavailable
	}
	tokens, err := p.ExchangeCode(ctx, ports.CodeExchange{Code: code, CodeVerifier: verifier, RedirectURI: a.RedirectURI})
	if err != nil {
		return Linked{}, err
	}
	if tokens.RefreshToken == "" {
		return Linked{}, fmt.Errorf("bank: the bank gave no refresh token: %w", ports.ErrProviderUnavailable)
	}
	fp, err := s.d.Fingerprints.Fingerprint(ctx, tokens.RefreshToken)
	if err != nil {
		return Linked{}, err
	}
	if err := s.d.Consents.MarkGranted(ctx, a.ConsentID, tokens.ProviderConsentID); err != nil {
		return Linked{}, err
	}
	now := s.d.Clock.Now()
	l := link.Link{
		ID: NewID(now), UserID: u.ID, DeviceID: u.DeviceID, Provider: a.Provider,
		ConsentID: a.ConsentID, TokenFingerprint: fp, Status: link.StatusActive, CreatedAt: now,
	}
	if err := s.d.Links.Insert(ctx, l); err != nil {
		if errors.Is(err, link.ErrConsentLinked) {
			return Linked{}, ErrConsentAlreadyLinked
		}
		return Linked{}, err
	}
	s.record(ctx, audit.Event{
		Type: audit.BankLinkCreated, UserID: u.ID, DeviceID: u.DeviceID, At: now,
		Meta: map[string]string{"provider": l.Provider, "link_id": l.ID, "status": string(l.Status)},
	})
	return Linked{
		LinkID: l.ID, Provider: l.Provider, AccessToken: tokens.AccessToken,
		RefreshToken: tokens.RefreshToken, ExpiresIn: tokens.ExpiresIn,
	}, nil
}

func (s *Service) provider(id string) (ports.Provider, bool) {
	if s.d.Providers == nil {
		return nil, false
	}
	return s.d.Providers.Provider(id)
}

// record writes an audit event. A failing audit store is logged and never undoes the action,
// as M4 does with consents.
func (s *Service) record(ctx context.Context, e audit.Event) {
	if s.d.Audit == nil {
		return
	}
	if err := s.d.Audit.Record(ctx, e); err != nil {
		s.d.Log.ErrorContext(ctx, "audit record failed", "type", e.Type, "error", err)
	}
}

func random() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// NewID returns a UUID v7: 48 bits of Unix milliseconds, then random bits.
func NewID(now time.Time) string {
	var b [16]byte
	_, _ = rand.Read(b[6:])
	ms := uint64(now.UnixMilli())
	for i := range 6 {
		b[i] = byte(ms >> (40 - 8*i))
	}
	b[6] = 0x70 | b[6]&0x0f // version 7
	b[8] = 0x80 | b[8]&0x3f // RFC 9562 variant
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
