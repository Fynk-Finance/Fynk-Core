// Package approvals holds the device approval rules of M2: a pending phone asks an active one
// to hand it the wrapped DEK. The server stores the wrapped key for one read and never holds a
// key that opens it.
package approvals

import (
	"context"
	"errors"
	"time"
)

// TTL is how long a request stays open.
const TTL = 10 * time.Minute

// Sizes of the grant fields, in bytes.
const (
	EphemeralKeySize = 32
	WrappedDEKSize   = 48
	NonceSize        = 12
	MaxIdempotency   = 128
)

// Status is the state of a request.
type Status string

// The states of a request.
const (
	Pending  Status = "pending"
	Approved Status = "approved"
	Rejected Status = "rejected"
	Expired  Status = "expired"
)

// Errors the service returns. None carries an id or key.
var (
	ErrNotActive     = errors.New("approvals: device not active")
	ErrAlreadyActive = errors.New("approvals: device already active")
	ErrNotFound      = errors.New("approvals: not found")
	ErrNotPending    = errors.New("approvals: not pending")
	ErrExpired       = errors.New("approvals: expired")
)

// Grant is what the old phone hands over: the DEK wrapped for the new phone.
type Grant struct {
	EphemeralPublicKey []byte
	WrappedDEK         []byte
	Nonce              []byte
}

// Approval is one request as stored. The key fields are empty unless Approved and unread.
type Approval struct {
	ID                 string
	UserID             string
	NewDeviceID        string
	NewDevicePublicKey []byte
	Status             Status
	Grant              Grant
	CreatedAt          time.Time
	ExpiresAt          time.Time
	DecidedAt          *time.Time
}

// Open is a request an old phone can still decide, with the new device's name and platform.
type Open struct {
	Approval
	DeviceName string
	Platform   string
}

// View is what the new phone reads. Keys is set only on the one read that returns the grant.
type View struct {
	Approval
	Keys *Grant
}

// Tx is the repository inside the user's lock.
type Tx interface {
	// ByKey returns the request the device created with this idempotency key.
	ByKey(ctx context.Context, deviceID, key string) (Approval, bool, error)
	// ExpirePending marks every pending request of the device expired.
	ExpirePending(ctx context.Context, deviceID string, at time.Time) error
	// Insert stores a new pending request. key may be empty.
	Insert(ctx context.Context, a Approval, key string) error
	// Lock returns the request locked for update, or ErrNotFound.
	Lock(ctx context.Context, id string) (Approval, error)
	// Decide stores the final status of the request.
	Decide(ctx context.Context, id string, s Status, at time.Time) error
	// Approve stores status approved with the grant.
	Approve(ctx context.Context, id string, g Grant, at time.Time) error
	// ClearGrant sets the three key fields to NULL.
	ClearGrant(ctx context.Context, id string) error
}

// Repo stores the requests. Writes of one user are serialized.
type Repo interface {
	// InTx runs fn in one transaction under the user's lock; an error from fn rolls back.
	InTx(ctx context.Context, userID string, fn func(Tx) error) error
	// Open returns the user's pending requests that expire after now, newest first.
	Open(ctx context.Context, userID string, now time.Time) ([]Approval, error)
}
