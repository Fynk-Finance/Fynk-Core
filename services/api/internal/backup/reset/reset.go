// Package reset holds the backup reset of M2 ("No tengo ninguno de los dos"): the person lost
// the old phone and the recovery code, proved the mailbox with a password reset by email code,
// and starts again with an empty backup. The server deletes ciphertext only; it never holds a
// key that opens it.
package reset

import (
	"context"
	"errors"
	"time"
)

// Rules of the reset window.
const (
	// Window is how long after the email-code reset the backup reset is allowed.
	Window = 10 * time.Minute
	// Skew is the clock difference tolerated between Keycloak and this server, both for a reset
	// time slightly in the future and for a session that started right before the reset.
	Skew = time.Minute
)

// AuditBackupReset is the audit event type of a backup reset (shared contracts, section 4.3).
// It is defined here, not in audit/ports (another module), and should move there when M13 adds it.
const AuditBackupReset = "backup.reset"

// Errors the service returns. None carries an id, a time or a session id.
var (
	ErrNotActive  = errors.New("reset: device not active")
	ErrNotAllowed = errors.New("reset: not allowed")
)

// Repo deletes the backup of a user.
type Repo interface {
	// DeleteBackup removes the user's records, recovery key and device approvals in one
	// transaction under the user's records and approvals locks. Deleting nothing is not an error.
	DeleteBackup(ctx context.Context, userID string) error
}
