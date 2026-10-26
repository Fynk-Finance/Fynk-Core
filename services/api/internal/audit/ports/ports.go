// Package ports is the public face of the audit module (shared contracts, section 4.3).
// M13 implements the append-only, hash-chained store. Until then M0's LogRecorder stands in.
package ports

import (
	"context"
	"log/slog"
	"time"
)

// Recorder writes one audit event.
type Recorder interface {
	Record(ctx context.Context, e Event) error
}

// Event is one audited action, such as "consent.granted".
type Event struct {
	Type     string // 'consent.granted', 'bank.sync', 'backup.restored'
	UserID   string
	DeviceID string
	At       time.Time
	Meta     map[string]string // never amounts, tokens, emails or account numbers
}

// Required event types (shared contracts, section 4.3).
const (
	AuthLogin                = "auth.login"
	AuthLoginFailed          = "auth.login_failed"
	AuthPasswordReset        = "auth.password_reset"
	DeviceRegistered         = "device.registered"
	DeviceApproved           = "device.approved"
	DeviceRejected           = "device.rejected"
	DeviceRemoved            = "device.removed"
	ConsentCreated           = "consent.created"
	ConsentGranted           = "consent.granted"
	ConsentRevoked           = "consent.revoked"
	ConsentExpired           = "consent.expired"
	BankLinkCreated          = "bank.link_created"
	BankSync                 = "bank.sync"
	BankSyncFailed           = "bank.sync_failed"
	BankTokenRefreshed       = "bank.token_refreshed"
	BackupUploaded           = "backup.uploaded"
	BackupRestored           = "backup.restored"
	RecoveryKeySet           = "recovery_key.set"
	PrivacyDeletionRequested = "privacy.deletion_requested"
	PrivacyDeletionCompleted = "privacy.deletion_completed"
)

// LogRecorder is M0's stub: it writes each event as one log line. The logger must be the
// redacting logger from platform/log, so a sensitive Meta key never reaches the output.
type LogRecorder struct {
	Log *slog.Logger
}

// NewLogRecorder returns the stub recorder.
func NewLogRecorder(l *slog.Logger) LogRecorder { return LogRecorder{Log: l} }

// Record implements Recorder.
func (r LogRecorder) Record(ctx context.Context, e Event) error {
	meta := make([]any, 0, len(e.Meta)*2)
	for k, v := range e.Meta {
		meta = append(meta, k, v)
	}
	r.Log.InfoContext(ctx, "audit",
		slog.String("type", e.Type),
		slog.String("user_id", e.UserID),
		slog.String("device_id", e.DeviceID),
		slog.Time("at", e.At),
		slog.Group("meta", meta...),
	)
	return nil
}
