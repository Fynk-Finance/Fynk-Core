// Package ports is the public face of the consents module (shared contracts, section 4.5).
// M5 calls Active before every request to a bank and answers 409 consent_revoked when false.
// New returns M4's real checker, backed by the consents schema. M0's LocalChecker stays for
// local work without a database.
package ports

import (
	"context"
	"errors"

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
	return service.New(store.New(d.DB), d.Clock, d.Audit, d.Log)
}

var _ ConsentChecker = (*service.Service)(nil)

// ConsentChecker answers whether a user's consent is still active.
type ConsentChecker interface {
	Active(ctx context.Context, userID, consentID string) (bool, error)
	MarkGranted(ctx context.Context, consentID, providerConsentID string) error
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
