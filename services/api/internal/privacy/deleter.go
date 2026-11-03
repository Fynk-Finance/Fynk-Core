package privacy

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	consents "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
)

// Errors returned by Deleter.
var (
	ErrFreshLoginRequired  = errors.New("fresh login required")
	ErrInvalidConfirmation = errors.New("invalid confirmation")
	ErrDeletionNotFound    = errors.New("deletion request not found")
)

var spanishMonths = [...]string{
	"",
	"enero", "febrero", "marzo", "abril", "mayo", "junio",
	"julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
}

// DeletionMessage formats the legal completion message required under Ley 1581 de 2012.
func DeletionMessage(t time.Time) string {
	m := int(t.Month())
	month := ""
	if m >= 1 && m <= 12 {
		month = spanishMonths[m]
	}
	return fmt.Sprintf("Tu cuenta y tus datos fueron eliminados el %d de %s de %d.", t.Day(), month, t.Year())
}

// Deleter handles account cascade deletion under Ley 1581 de 2012.
type Deleter struct {
	pool            *pgxpool.Pool
	clock           clock.Clock
	audit           audit.Recorder
	sessions        identity.Sessions
	consentsRevoker consents.ConsentsRevoker
	userDeleter     identity.UserDeleter
}

// NewDeleter creates a new Deleter.
func NewDeleter(
	pool *pgxpool.Pool,
	clk clock.Clock,
	audit audit.Recorder,
	sessions identity.Sessions,
	consentsRevoker consents.ConsentsRevoker,
	userDeleter identity.UserDeleter,
) *Deleter {
	if clk == nil {
		clk = clock.System{}
	}
	return &Deleter{
		pool:            pool,
		clock:           clk,
		audit:           audit,
		sessions:        sessions,
		consentsRevoker: consentsRevoker,
		userDeleter:     userDeleter,
	}
}

// DeleteAccount executes cascade account deletion.
func (d *Deleter) DeleteAccount(ctx context.Context, user auth.User, req httpapi.PrivacyDeletionRequestCreate) (httpapi.PrivacyDeletionRequest, error) {
	// 0. Verify fresh login if sessions port is configured
	if d.sessions != nil {
		if user.SessionID == "" {
			return httpapi.PrivacyDeletionRequest{}, ErrFreshLoginRequired
		}
		start, found, err := d.sessions.SessionStart(ctx, user.ID, user.SessionID)
		if err != nil {
			return httpapi.PrivacyDeletionRequest{}, fmt.Errorf("privacy: session check: %w", err)
		}
		if !found || d.clock.Now().Sub(start) > 5*time.Minute {
			return httpapi.PrivacyDeletionRequest{}, ErrFreshLoginRequired
		}
	}

	// 0b. Verify confirmation keyword if provided
	if req.Confirmation != nil && *req.Confirmation != "" && *req.Confirmation != "ELIMINAR" {
		return httpapi.PrivacyDeletionRequest{}, ErrInvalidConfirmation
	}

	reqID := uuid.New()
	hash := sha256.Sum256([]byte(user.ID))
	userIDHash := hash[:]
	now := d.clock.Now().UTC()

	// Initial request record
	if d.pool != nil {
		const insertReq = `
			INSERT INTO privacy.deletion_requests (id, user_id_hash, status, steps_done, created_at)
			VALUES ($1, $2, 'in_progress', $3, $4)
		`
		if _, err := d.pool.Exec(ctx, insertReq, reqID, userIDHash, []string{}, now); err != nil {
			return httpapi.PrivacyDeletionRequest{}, fmt.Errorf("privacy: insert deletion request: %w", err)
		}
	}

	// Audit start
	if d.audit != nil {
		_ = d.audit.Record(ctx, audit.Event{
			Type:     audit.PrivacyDeletionRequested,
			UserID:   user.ID,
			DeviceID: user.DeviceID,
			At:       now,
			Meta: map[string]string{
				"request_id": reqID.String(),
			},
		})
	}

	stepsDone := make([]string, 0, 5)
	fail := func(err error) (httpapi.PrivacyDeletionRequest, error) {
		if d.pool != nil {
			_, _ = d.pool.Exec(ctx, `UPDATE privacy.deletion_requests SET status = 'failed', steps_done = $2 WHERE id = $1`, reqID, stepsDone)
		}
		return httpapi.PrivacyDeletionRequest{}, err
	}

	// Step 1: Revoke every consent through M4 (notifies bank provider)
	if d.consentsRevoker != nil {
		if err := d.consentsRevoker.RevokeAll(ctx, user.ID); err != nil {
			return fail(fmt.Errorf("privacy: revoke consents: %w", err))
		}
	}
	stepsDone = append(stepsDone, "consents_revoked")

	// Steps 2, 3, 4: Database cascade
	if d.pool != nil {
		tx, err := d.pool.Begin(ctx)
		if err != nil {
			return fail(fmt.Errorf("privacy: begin deletion tx: %w", err))
		}
		defer func() { _ = tx.Rollback(ctx) }()

		// Step 2: Mark every bank link revoked and delete bank link records
		if _, err := tx.Exec(ctx, `UPDATE bank.links SET status = 'revoked', revoked_at = $2 WHERE user_id = $1 AND status = 'active'`, user.ID, now); err != nil {
			return fail(fmt.Errorf("privacy: revoke bank links: %w", err))
		}
		if _, err := tx.Exec(ctx, `DELETE FROM bank.links WHERE user_id = $1`, user.ID); err != nil {
			return fail(fmt.Errorf("privacy: delete bank links: %w", err))
		}

		// Step 3: Delete backup records, recovery key, and device approvals
		if _, err := tx.Exec(ctx, `DELETE FROM backup.records WHERE user_id = $1`, user.ID); err != nil {
			return fail(fmt.Errorf("privacy: delete backup records: %w", err))
		}
		if _, err := tx.Exec(ctx, `DELETE FROM backup.recovery_keys WHERE user_id = $1`, user.ID); err != nil {
			return fail(fmt.Errorf("privacy: delete recovery keys: %w", err))
		}
		if _, err := tx.Exec(ctx, `DELETE FROM backup.device_approvals WHERE user_id = $1`, user.ID); err != nil {
			return fail(fmt.Errorf("privacy: delete device approvals: %w", err))
		}

		// Step 4: Delete registered devices
		if _, err := tx.Exec(ctx, `DELETE FROM identity.devices WHERE user_id = $1`, user.ID); err != nil {
			return fail(fmt.Errorf("privacy: delete devices: %w", err))
		}

		if err := tx.Commit(ctx); err != nil {
			return fail(fmt.Errorf("privacy: commit deletion tx: %w", err))
		}
	}
	stepsDone = append(stepsDone, "bank_links_revoked", "backup_deleted", "devices_deleted")

	// Step 5: Delete the Keycloak user via Keycloak admin API
	if d.userDeleter != nil {
		if err := d.userDeleter.DeleteUser(ctx, user.ID); err != nil {
			return fail(fmt.Errorf("privacy: delete keycloak user: %w", err))
		}
	}
	stepsDone = append(stepsDone, "keycloak_deleted")

	// Step 6: Complete deletion request
	completedAt := d.clock.Now().UTC()
	if d.pool != nil {
		const updateCompleted = `
			UPDATE privacy.deletion_requests
			SET status = 'completed', steps_done = $2, completed_at = $3
			WHERE id = $1
		`
		if _, err := d.pool.Exec(ctx, updateCompleted, reqID, stepsDone, completedAt); err != nil {
			return httpapi.PrivacyDeletionRequest{}, fmt.Errorf("privacy: update completion: %w", err)
		}
	}

	if d.audit != nil {
		_ = d.audit.Record(ctx, audit.Event{
			Type:     audit.PrivacyDeletionCompleted,
			UserID:   user.ID,
			DeviceID: user.DeviceID,
			At:       completedAt,
			Meta: map[string]string{
				"request_id": reqID.String(),
			},
		})
	}

	msg := DeletionMessage(completedAt)
	return httpapi.PrivacyDeletionRequest{
		Id:          reqID,
		Status:      httpapi.Completed,
		StepsDone:   &stepsDone,
		CreatedAt:   now,
		CompletedAt: &completedAt,
		Message:     msg,
	}, nil
}

// GetRequest retrieves the status and message of a deletion request by ID.
func (d *Deleter) GetRequest(ctx context.Context, id uuid.UUID) (httpapi.PrivacyDeletionRequest, error) {
	if d.pool == nil {
		return httpapi.PrivacyDeletionRequest{}, ErrDeletionNotFound
	}

	const q = `
		SELECT status, steps_done, created_at, completed_at
		FROM privacy.deletion_requests
		WHERE id = $1
	`
	var status string
	var stepsDone []string
	var createdAt time.Time
	var completedAt *time.Time

	err := d.pool.QueryRow(ctx, q, id).Scan(&status, &stepsDone, &createdAt, &completedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return httpapi.PrivacyDeletionRequest{}, ErrDeletionNotFound
	}
	if err != nil {
		return httpapi.PrivacyDeletionRequest{}, fmt.Errorf("privacy: query deletion request: %w", err)
	}

	var msg string
	switch status {
	case string(httpapi.Completed):
		if completedAt != nil {
			msg = DeletionMessage(*completedAt)
		} else {
			msg = DeletionMessage(createdAt)
		}
	case string(httpapi.InProgress):
		msg = "Tu solicitud de eliminación se encuentra en proceso."
	default:
		msg = "La solicitud de eliminación no pudo completarse."
	}

	return httpapi.PrivacyDeletionRequest{
		Id:          id,
		Status:      httpapi.PrivacyDeletionRequestStatus(status),
		StepsDone:   &stepsDone,
		CreatedAt:   createdAt,
		CompletedAt: completedAt,
		Message:     msg,
	}, nil
}
