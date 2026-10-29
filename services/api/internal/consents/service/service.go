// Package service holds the use cases of M4: publish the text, record a consent, list it,
// grant it after the bank link and expire it. It implements ports.ConsentChecker for M5.
package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"log/slog"
	"slices"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	bankports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Store keeps consents and texts. Errors for missing rows are the domain errors.
type Store interface {
	CurrentText(ctx context.Context) (domain.Text, error)
	TextByVersion(ctx context.Context, version string) (domain.Text, error)
	// Insert stores c. With a non-empty key, a consent already stored by the same user with
	// that key is returned instead, with created false.
	Insert(ctx context.Context, c domain.Consent, idempotencyKey string) (stored domain.Consent, created bool, err error)
	Get(ctx context.Context, id string) (domain.Consent, error)
	ListByUser(ctx context.Context, userID string) ([]domain.Consent, error) // newest first
	// Activate writes a granted consent if it is still pending, or returns ErrNotPending.
	Activate(ctx context.Context, c domain.Consent) error
	// ExpireDue marks active consents whose term ended at now as expired and returns them.
	ExpireDue(ctx context.Context, now time.Time) ([]domain.Consent, error)
	// MarkRevoked writes a revoked consent if it is still active or pending, or returns
	// ErrNotRevocable.
	MarkRevoked(ctx context.Context, c domain.Consent) error
	// SaveNotice writes the notice fields (ProviderNotifiedAt, NextNotifyAt, NotifyAttempts).
	SaveNotice(ctx context.Context, c domain.Consent) error
	// ClaimNotices returns up to limit revoked consents whose notice is due at now, and moves
	// their NextNotifyAt to lease so another instance does not pick them at the same time.
	ClaimNotices(ctx context.Context, now, lease time.Time, limit int) ([]domain.Consent, error)
}

// Revoker tells the entity that a consent was revoked (bank/ports.Revoker, implemented by M5).
type Revoker interface {
	RevokeConsent(ctx context.Context, provider, providerConsentID string) error
}

// BankRevoker reaches the revoker M5 installed, at call time (bank/ports.InstalledRevoker).
type BankRevoker struct{}

// RevokeConsent implements Revoker.
func (BankRevoker) RevokeConsent(ctx context.Context, provider, providerConsentID string) error {
	return bankports.InstalledRevoker().RevokeConsent(ctx, provider, providerConsentID)
}

// noticeTimeout bounds the first notice, made while the user waits for the revoke answer.
const noticeTimeout = 5 * time.Second

// Service runs the consent use cases.
type Service struct {
	store   Store
	clock   clock.Clock
	audit   audit.Recorder
	log     *slog.Logger
	revoker Revoker
}

// New returns the service.
func New(store Store, clk clock.Clock, rec audit.Recorder, log *slog.Logger, revoker Revoker) *Service {
	return &Service{store: store, clock: clk, audit: rec, log: log, revoker: revoker}
}

// CurrentText is the text, purpose and term the app shows on Conectar banco.
func (s *Service) CurrentText(ctx context.Context) (domain.Text, error) {
	return s.store.CurrentText(ctx)
}

// Create records the user's explicit acceptance as a pending consent.
func (s *Service) Create(ctx context.Context, r domain.Request, idempotencyKey string) (domain.Consent, error) {
	text, err := s.store.TextByVersion(ctx, r.TextVersion)
	if err != nil {
		return domain.Consent{}, err
	}
	now := s.clock.Now()
	c, err := domain.NewPending(newID(now), r, supportedScopes(r.Provider), text, now)
	if err != nil {
		return domain.Consent{}, err
	}
	stored, created, err := s.store.Insert(ctx, c, idempotencyKey)
	if err != nil {
		return domain.Consent{}, err
	}
	if !created {
		if stored.Provider != c.Provider || !slices.Equal(stored.Scopes, c.Scopes) || stored.TextVersion != c.TextVersion {
			return domain.Consent{}, domain.ErrIdempotencyConflict
		}
		return stored, nil
	}
	s.record(ctx, audit.ConsentCreated, stored, now)
	return stored, nil
}

// List returns the user's consents, newest first, with their status as of now.
func (s *Service) List(ctx context.Context, userID string) ([]domain.Consent, error) {
	list, err := s.store.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	now := s.clock.Now()
	for i := range list {
		list[i].Status = list[i].StatusAt(now)
	}
	return list, nil
}

// Get returns one consent of the user. Another user's consent is reported as not found.
func (s *Service) Get(ctx context.Context, userID, id string) (domain.Consent, error) {
	c, err := s.store.Get(ctx, id)
	if err != nil {
		return domain.Consent{}, err
	}
	if c.UserID != userID {
		return domain.Consent{}, domain.ErrNotFound
	}
	c.Status = c.StatusAt(s.clock.Now())
	return c, nil
}

// Active implements ports.ConsentChecker: true only for the user's own active consent
// whose term has not ended. M5 calls it before every bank request.
func (s *Service) Active(ctx context.Context, userID, consentID string) (bool, error) {
	c, err := s.Get(ctx, userID, consentID)
	if errors.Is(err, domain.ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return c.Status == domain.StatusActive, nil
}

// MarkGranted implements ports.ConsentChecker: M5 calls it once the bank returned tokens.
func (s *Service) MarkGranted(ctx context.Context, consentID, providerConsentID string) error {
	c, err := s.store.Get(ctx, consentID)
	if err != nil {
		return err
	}
	text, err := s.store.TextByVersion(ctx, c.TextVersion)
	if err != nil {
		return err
	}
	now := s.clock.Now()
	granted, err := c.Grant(providerConsentID, text, now)
	if err != nil {
		return err
	}
	if err := s.store.Activate(ctx, granted); err != nil {
		return err
	}
	s.record(ctx, audit.ConsentGranted, granted, now)
	return nil
}

// ExpireDue marks every consent whose term ended as expired and audits each one once.
func (s *Service) ExpireDue(ctx context.Context) (int, error) {
	now := s.clock.Now()
	expired, err := s.store.ExpireDue(ctx, now)
	if err != nil {
		return 0, err
	}
	for _, c := range expired {
		s.record(ctx, audit.ConsentExpired, c, now)
	}
	return len(expired), nil
}

// RunExpiry runs ExpireDue now and then every interval until ctx ends. Active already
// treats an ended term as inactive, so the job only keeps the stored status and audit current.
func (s *Service) RunExpiry(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		if n, err := s.ExpireDue(ctx); err != nil {
			s.log.ErrorContext(ctx, "consent expiry failed", "error", err)
		} else if n > 0 {
			s.log.InfoContext(ctx, "consents expired", "count", n)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// Revoke ends the user's consent at once (HU-008): from this moment Active is false and M5's
// next query answers 409 consent_revoked. Then it tells the entity; if that fails, the retry
// job tries again every 10 minutes for 24 hours. An already revoked consent is returned as is.
func (s *Service) Revoke(ctx context.Context, userID, id string) (domain.Consent, error) {
	c, err := s.Get(ctx, userID, id)
	if err != nil {
		return domain.Consent{}, err
	}
	now := s.clock.Now()
	revoked, err := c.Revoke(domain.ReasonUserRequest, now)
	if errors.Is(err, domain.ErrAlreadyRevoked) {
		return c, nil
	}
	if err != nil {
		return domain.Consent{}, err
	}
	if err := s.store.MarkRevoked(ctx, revoked); err != nil {
		if errors.Is(err, domain.ErrNotRevocable) {
			// A concurrent revoke or expiry won: answer with what is stored now.
			return s.Get(ctx, userID, id)
		}
		return domain.Consent{}, err
	}
	s.record(ctx, audit.ConsentRevoked, revoked, now)
	if revoked.NextNotifyAt != nil {
		nctx, cancel := context.WithTimeout(ctx, noticeTimeout)
		revoked = s.notify(nctx, revoked)
		cancel()
	}
	revoked.Status = revoked.StatusAt(now)
	return revoked, nil
}

// NotifyDue tells the entities about revocations whose notice is due and returns how many
// were confirmed.
func (s *Service) NotifyDue(ctx context.Context) (int, error) {
	now := s.clock.Now()
	due, err := s.store.ClaimNotices(ctx, now, now.Add(domain.NotifyRetryEvery), 50)
	if err != nil {
		return 0, err
	}
	confirmed := 0
	for _, c := range due {
		if s.notify(ctx, c).ProviderNotifiedAt != nil {
			confirmed++
		}
	}
	return confirmed, nil
}

// RunNotify runs NotifyDue now and then every interval until ctx ends.
func (s *Service) RunNotify(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		if _, err := s.NotifyDue(ctx); err != nil {
			s.log.ErrorContext(ctx, "consent revocation notices failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
	}
}

// notify calls the entity once and stores the outcome. Errors are logged by code only.
func (s *Service) notify(ctx context.Context, c domain.Consent) domain.Consent {
	now := s.clock.Now()
	err := s.revoker.RevokeConsent(ctx, c.Provider, c.ProviderConsentID)
	if err == nil {
		c = c.Notified(now)
	} else {
		c = c.NoticeFailed(now)
		if c.NextNotifyAt == nil {
			s.log.ErrorContext(ctx, "consent revocation notice gave up after 24 hours",
				"consent_id", c.ID, "provider", c.Provider, "attempts", c.NotifyAttempts, "error_code", errorCode(err))
		} else {
			s.log.WarnContext(ctx, "consent revocation notice failed, will retry",
				"consent_id", c.ID, "provider", c.Provider, "attempts", c.NotifyAttempts, "error_code", errorCode(err))
		}
	}
	if serr := s.store.SaveNotice(ctx, c); serr != nil {
		s.log.ErrorContext(ctx, "consent revocation notice not saved", "consent_id", c.ID, "error", serr)
	}
	return c
}

// errorCode names a bank error without its text.
func errorCode(err error) string {
	var bank *bankports.Error
	if errors.As(err, &bank) {
		return bank.Code
	}
	var limited *bankports.RateLimitedError
	if errors.As(err, &limited) {
		return limited.Code()
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	return "unknown"
}

// supportedScopes is what M5's provider list says the provider offers, nil when not offered.
func supportedScopes(provider string) []domain.Scope {
	info, ok := bankports.Lookup(provider)
	if !ok {
		return nil
	}
	out := make([]domain.Scope, len(info.Scopes))
	for i, sc := range info.Scopes {
		out[i] = domain.Scope(sc)
	}
	return out
}

// record writes the audit event of a state change. The change is already stored and the
// consent row keeps its own dates, so a failing audit store is logged instead of undoing it.
func (s *Service) record(ctx context.Context, typ string, c domain.Consent, at time.Time) {
	err := s.audit.Record(ctx, audit.Event{
		Type:     typ,
		UserID:   c.UserID,
		DeviceID: c.DeviceID,
		At:       at,
		Meta:     map[string]string{"provider": c.Provider, "consent_id": c.ID},
	})
	if err != nil {
		s.log.ErrorContext(ctx, "audit record failed", "type", typ, "consent_id", c.ID, "error", err)
	}
}

// newID returns a UUID v7: 48 bits of Unix milliseconds, then random bits.
func newID(now time.Time) string {
	var b [16]byte
	_, _ = rand.Read(b[6:])
	ms := uint64(now.UnixMilli())
	for i := 0; i < 6; i++ {
		b[i] = byte(ms >> (40 - 8*i))
	}
	b[6] = 0x70 | b[6]&0x0f // version 7
	b[8] = 0x80 | b[8]&0x3f // RFC 9562 variant
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:])
}
