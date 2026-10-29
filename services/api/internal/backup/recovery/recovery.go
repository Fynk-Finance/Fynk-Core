// Package recovery holds the recovery key rules of M2: the DEK wrapped with the recovery code
// and the proof that lets a pending device activate itself. The server never holds a key that
// opens anything; it keeps only the wrapped DEK and the SHA-256 of a proof.
package recovery

import (
	"context"
	"errors"
	"time"
)

// Sizes of the stored values, in bytes.
const (
	WrappedDEKSize = 48
	NonceSize      = 12
	SaltSize       = 16
	ProofSize      = 32
)

// Argon2id parameters the phone must use (M02-vault.md). Changing them needs a team decision.
const (
	KDF         = "argon2id"
	MemoryKiB   = 65536
	Iterations  = 3
	Parallelism = 1
)

// MaxFailures is the number of wrong proofs per user per hour before activation is blocked.
const MaxFailures = 5

// Errors the service returns.
var (
	ErrNotActive = errors.New("recovery: device not active")
	ErrNoKey     = errors.New("recovery: no recovery key")
	ErrMismatch  = errors.New("recovery: proof mismatch")
	ErrTooMany   = errors.New("recovery: too many attempts")
	ErrRemoved   = errors.New("recovery: device removed")
)

// Key is the stored recovery key. ProofHash is empty when read for a client.
type Key struct {
	WrappedDEK, Nonce, Salt []byte
	KDF                     string
	MemoryKiB               int
	Iterations              int
	Parallelism             int
	ProofHash               []byte
	CreatedAt               time.Time
}

// Repo stores one recovery key per user.
type Repo interface {
	// Put replaces the user's key.
	Put(ctx context.Context, userID string, k Key) error
	// Get returns ErrNoKey when the user has none.
	Get(ctx context.Context, userID string) (Key, error)
}

// Limiter counts failed activation attempts per user over the last hour.
type Limiter interface {
	// Blocked reports whether the user already failed MaxFailures times in the window.
	Blocked(ctx context.Context, userID string) (bool, error)
	// Fail records one failed attempt.
	Fail(ctx context.Context, userID string) error
}
