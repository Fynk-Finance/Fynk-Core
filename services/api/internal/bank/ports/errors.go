package ports

import (
	"strconv"
	"time"
)

// Error is a bank failure with a stable problem code. Details never hold personal data.
type Error struct {
	Code   string
	Detail string
}

func (e *Error) Error() string { return e.Code + ": " + e.Detail }

// Errors every adapter maps the bank's answers to.
var (
	// ErrConsentRevoked: the bank no longer accepts the consent. M5 answers 409 consent_revoked.
	ErrConsentRevoked = &Error{"consent_revoked", "The consent for this bank was revoked or expired."}
	// ErrProviderUnavailable: the provider cannot be used, for example Bancolombia before its spike.
	ErrProviderUnavailable = &Error{"provider_unavailable", "This entity is not available right now."}
	// ErrInvalidGrant: the bank rejected the code or the refresh token.
	ErrInvalidGrant = &Error{"invalid_grant", "The bank rejected the authorization."}
)

// RateLimitedError: the bank asked to slow down. M5 passes it back as 429 with Retry-After.
type RateLimitedError struct {
	RetryAfter time.Duration
}

func (e *RateLimitedError) Error() string {
	return "rate_limited: retry after " + strconv.Itoa(int(e.RetryAfter.Seconds())) + "s"
}

// Code is the stable problem code.
func (e *RateLimitedError) Code() string { return "rate_limited" }
