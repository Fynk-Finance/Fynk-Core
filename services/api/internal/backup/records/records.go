// Package records holds the encrypted record rules of M2: the server stores and returns
// ciphertext envelopes it cannot read, with a per-user quota and a version check.
package records

import (
	"context"
	"encoding/base64"
	"errors"
	"strconv"
	"time"
)

// Limits of the record API.
const (
	MaxBatch       = 200
	DefaultLimit   = 200
	MaxLimit       = 500
	NonceSize      = 12
	MinCiphertext  = 16 // the GCM tag alone
	MaxCiphertext  = 65536
	QuotaBytes     = 5 * 1024 * 1024
	MaxBodyBytes   = 6 * 1024 * 1024 // a bigger body can never fit the quota
	MaxCollection  = 64
	MaxCursorChars = 128
)

// Errors the service returns.
var (
	ErrNotActive = errors.New("records: device not active")
	ErrStale     = errors.New("records: stale version")
	ErrQuota     = errors.New("records: quota exceeded")
	ErrBadCursor = errors.New("records: invalid cursor")
)

// Envelope is one encrypted record as the client sends it.
type Envelope struct {
	Collection string
	RecordID   string
	Version    int64
	Deleted    bool
	Nonce      []byte
	Ciphertext []byte
}

// Stored is an envelope as kept by the server.
type Stored struct {
	Envelope
	Seq       int64
	UpdatedAt time.Time
}

// Page is one page of records. Next is empty on the last page.
type Page struct {
	Records []Stored
	Next    string
}

// Tx is the repository inside the user's lock.
type Tx interface {
	// Upsert stores e with a new seq and updatedAt. It reports false, storing nothing, when a
	// higher version is already stored.
	Upsert(ctx context.Context, userID string, e Envelope, updatedAt time.Time) (bool, error)
	// Usage returns the stored bytes (ciphertext plus nonce) of the user.
	Usage(ctx context.Context, userID string) (int64, error)
}

// Repo stores the records. Writes and page reads of one user are serialized, so per user the
// seq order is the commit order and no page can skip a row committed later.
type Repo interface {
	// InTx runs fn in one transaction under the user's lock; an error from fn rolls back.
	InTx(ctx context.Context, userID string, fn func(Tx) error) error
	// After returns up to limit records with seq greater than after, by seq.
	After(ctx context.Context, userID string, after int64, limit int) ([]Stored, error)
}

// EncodeCursor makes the opaque cursor of a seq. It carries no personal data.
func EncodeCursor(seq int64) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.FormatInt(seq, 10)))
}

// DecodeCursor returns the seq of a cursor, or ErrBadCursor. Empty means from the start.
func DecodeCursor(c string) (int64, error) {
	if c == "" {
		return 0, nil
	}
	b, err := base64.RawURLEncoding.Strict().DecodeString(c)
	if err != nil {
		return 0, ErrBadCursor
	}
	n, err := strconv.ParseInt(string(b), 10, 64)
	if err != nil || n < 0 || strconv.FormatInt(n, 10) != string(b) {
		return 0, ErrBadCursor
	}
	return n, nil
}
