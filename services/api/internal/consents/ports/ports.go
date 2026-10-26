// Package ports is the public face of the consents module (shared contracts, section 4.5).
// M5 calls Active before every request to a bank and answers 409 consent_revoked when false.
// M4 implements the real checker. Until then M0's LocalChecker stands in.
package ports

import (
	"context"
	"errors"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

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
