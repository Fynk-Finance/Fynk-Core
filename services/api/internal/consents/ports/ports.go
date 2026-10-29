// Package ports is the public face of the consents module (shared contracts, section 4.5).
// M5 calls Active before every request to a bank and answers 409 consent_revoked when false.
// New returns M4's real checker, backed by the consents schema. M0's LocalChecker stays for
// local work without a database.
package ports

import (
	"context"
	"errors"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/service"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/store"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

// New returns the real ConsentChecker. M5 builds it from the Deps it receives:
//
//	consents := consentports.New(d)
//
// Active is false for anything not active or past its expiry, and for another user's consent.
func New(d module.Deps) ConsentChecker {
	return service.New(store.New(d.DB), d.Clock, d.Audit, d.Log, service.BankRevoker{})
}

var _ ConsentChecker = (*service.Service)(nil)

// ConsentChecker answers whether a user's consent is still active.
type ConsentChecker interface {
	Active(ctx context.Context, userID, consentID string) (bool, error)
	MarkGranted(ctx context.Context, consentID, providerConsentID string) error
}

// Pending is a user's consent that waits for the bank: M5 starts the link with it, sending
// the bank exactly the scopes, purpose and term the user accepted.
type Pending struct {
	ID       string
	Provider string
	Scopes   []string
	Purpose  string
	TermDays int
}

// PendingReader gives M5 the user's pending consent before a link starts.
type PendingReader interface {
	// Pending returns ErrConsentNotFound for an unknown consent or another user's, and
	// ErrConsentNotPending when it is already active, revoked, expired or failed.
	Pending(ctx context.Context, userID, consentID string) (Pending, error)
}

// Errors of PendingReader, with M4's stable codes (consent_not_found, consent_not_pending).
var (
	ErrConsentNotFound   = domain.ErrNotFound
	ErrConsentNotPending = domain.ErrNotPending
)

// NewPendingReader returns M4's PendingReader, backed by the consents schema.
func NewPendingReader(d module.Deps) PendingReader {
	return pendingReader{svc: service.New(store.New(d.DB), d.Clock, d.Audit, d.Log, service.BankRevoker{})}
}

type consentGetter interface {
	Get(ctx context.Context, userID, id string) (domain.Consent, error)
}

type pendingReader struct{ svc consentGetter }

func (p pendingReader) Pending(ctx context.Context, userID, consentID string) (Pending, error) {
	c, err := p.svc.Get(ctx, userID, consentID)
	if err != nil {
		return Pending{}, err
	}
	if c.Status != domain.StatusPending {
		return Pending{}, ErrConsentNotPending
	}
	scopes := make([]string, len(c.Scopes))
	for i, s := range c.Scopes {
		scopes[i] = string(s)
	}
	return Pending{ID: c.ID, Provider: c.Provider, Scopes: scopes, Purpose: c.Purpose, TermDays: c.TermDays}, nil
}

// ErrNotImplemented is returned by the stub outside local.
var ErrNotImplemented = errors.New("consents: checker not implemented yet")

// LocalChecker is M0's stub: every consent is active when APP_ENV=local.
// Anywhere else it fails closed, so a missing M4 can never let a bank call through.
type LocalChecker struct {
	Env config.Env
}

// Active implements ConsentChecker.
func (c LocalChecker) Active(context.Context, string, string) (bool, error) {
	if c.Env != config.EnvLocal {
		return false, ErrNotImplemented
	}
	return true, nil
}

// MarkGranted implements ConsentChecker.
func (c LocalChecker) MarkGranted(context.Context, string, string) error {
	if c.Env != config.EnvLocal {
		return ErrNotImplemented
	}
	return nil
}
