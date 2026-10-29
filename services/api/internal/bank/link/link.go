// Package link is the bank link: one consent of one user, on one device, at one provider.
// The API keeps it with an HMAC fingerprint of the refresh token, never the token itself.
package link

import (
	"context"
	"errors"
	"time"
)

// Status of a link.
type Status string

// Link statuses.
const (
	StatusActive  Status = "active"
	StatusRevoked Status = "revoked"
)

// Link is one row of bank.links.
type Link struct {
	ID               string
	UserID           string
	DeviceID         string
	Provider         string
	ConsentID        string
	TokenFingerprint []byte
	Status           Status
	CreatedAt        time.Time
	LastRefreshedAt  *time.Time
	RevokedAt        *time.Time
}

// Errors of the link rules. They never say whose link it is.
var (
	// ErrNotFound: no link with that id for this user and device.
	ErrNotFound = errors.New("bank: link not found")
	// ErrRevoked: the link ended; the next call answers 409 consent_revoked.
	ErrRevoked = errors.New("bank: link revoked")
	// ErrStale: the refresh token is not the link's current one, or another refresh won.
	ErrStale = errors.New("bank: refresh token does not match the link")
	// ErrConsentLinked: the consent already has a link (one link per consent).
	ErrConsentLinked = errors.New("bank: consent already linked")
	// ErrAuthorizationNotFound: the started link is unknown, used, expired or another user's.
	ErrAuthorizationNotFound = errors.New("bank: authorization not found")
)

// AuthorizationTTL is how long a started link waits for the bank's answer (M5 prompt).
const AuthorizationTTL = 10 * time.Minute

// Authorization is a link started with a pushed authorization request, waiting for the code.
// It holds ids only: the PKCE verifier stays on the phone and the code arrives at exchange.
type Authorization struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	DeviceID    string    `json:"device_id"`
	ConsentID   string    `json:"consent_id"`
	Provider    string    `json:"provider"`
	RedirectURI string    `json:"redirect_uri"`
	ExpiresAt   time.Time `json:"expires_at"`
}

// Store keeps the links (Postgres in the API, memory in tests).
type Store interface {
	// Insert stores a new active link, or answers ErrConsentLinked.
	Insert(ctx context.Context, l Link) error
	// Get returns the link, or ErrNotFound.
	Get(ctx context.Context, id string) (Link, error)
	// Rotate replaces the fingerprint old with next on an active link, or answers ErrStale,
	// so two refreshes with the same token can never both win.
	Rotate(ctx context.Context, id string, old, next []byte, at time.Time) error
	// Revoke ends the link. Revoking twice keeps the first date.
	Revoke(ctx context.Context, id string, at time.Time) error
}

// UsableBy checks the link before a bank call: it must belong to the user and to the device
// that created it, and still be active. Another user's or device's link reads as not found.
func (l Link) UsableBy(userID, deviceID string) error {
	if l.UserID != userID || l.DeviceID != deviceID {
		return ErrNotFound
	}
	if l.Status != StatusActive {
		return ErrRevoked
	}
	return nil
}
