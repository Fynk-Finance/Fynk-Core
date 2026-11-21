package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/approvals"
)

// ApprovalsRepo implements approvals.Repo on backup.device_approvals. Errors never carry keys.
type ApprovalsRepo struct{ pool *pgxpool.Pool }

// NewApprovals returns a repository over pool (it may be nil until the first request).
func NewApprovals(pool *pgxpool.Pool) *ApprovalsRepo { return &ApprovalsRepo{pool: pool} }

var _ approvals.Repo = (*ApprovalsRepo)(nil)

const approvalsLockSQL = `SELECT pg_advisory_xact_lock(hashtext('backup.approvals:' || $1::text))`

const approvalCols = `id::text, user_id, new_device_id::text, new_device_public_key, status,
	ephemeral_public_key, wrapped_dek, nonce, created_at, expires_at, decided_at`

type approvalsTx struct{ tx pgx.Tx }

// InTx implements approvals.Repo: the user's lock is held until commit or rollback.
func (r *ApprovalsRepo) InTx(ctx context.Context, userID string, fn func(approvals.Tx) error) (err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin approvals tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()
	if _, err = tx.Exec(ctx, approvalsLockSQL, userID); err != nil {
		return fmt.Errorf("lock user approvals: %w", err)
	}
	if err = fn(approvalsTx{tx}); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit approvals: %w", err)
	}
	return nil
}

func scanApproval(row pgx.Row) (approvals.Approval, error) {
	var (
		a  approvals.Approval
		st string
	)
	err := row.Scan(&a.ID, &a.UserID, &a.NewDeviceID, &a.NewDevicePublicKey, &st,
		&a.Grant.EphemeralPublicKey, &a.Grant.WrappedDEK, &a.Grant.Nonce, &a.CreatedAt, &a.ExpiresAt, &a.DecidedAt)
	a.Status = approvals.Status(st)
	return a, err
}

// ByKey implements approvals.Tx.
func (t approvalsTx) ByKey(ctx context.Context, deviceID, key string) (approvals.Approval, bool, error) {
	a, err := scanApproval(t.tx.QueryRow(ctx,
		`SELECT `+approvalCols+` FROM backup.device_approvals WHERE new_device_id = $1::uuid AND idempotency_key = $2`,
		deviceID, key))
	if errors.Is(err, pgx.ErrNoRows) {
		return approvals.Approval{}, false, nil
	}
	if err != nil {
		return approvals.Approval{}, false, fmt.Errorf("find approval by key: %w", err)
	}
	return a, true, nil
}

// ExpirePending implements approvals.Tx.
func (t approvalsTx) ExpirePending(ctx context.Context, deviceID string, at time.Time) error {
	_, err := t.tx.Exec(ctx, `UPDATE backup.device_approvals SET status = 'expired', decided_at = $2
		WHERE new_device_id = $1::uuid AND status = 'pending'`, deviceID, at)
	if err != nil {
		return fmt.Errorf("expire pending approvals: %w", err)
	}
	return nil
}

// Insert implements approvals.Tx.
func (t approvalsTx) Insert(ctx context.Context, a approvals.Approval, key string) error {
	var k *string
	if key != "" {
		k = &key
	}
	_, err := t.tx.Exec(ctx, `
		INSERT INTO backup.device_approvals (id, user_id, new_device_id, new_device_public_key, status, created_at, expires_at, idempotency_key)
		VALUES ($1::uuid, $2, $3::uuid, $4, $5, $6, $7, $8)`,
		a.ID, a.UserID, a.NewDeviceID, a.NewDevicePublicKey, string(a.Status), a.CreatedAt, a.ExpiresAt, k)
	if err != nil {
		return fmt.Errorf("insert approval: %w", err)
	}
	return nil
}

// Lock implements approvals.Tx.
func (t approvalsTx) Lock(ctx context.Context, id string) (approvals.Approval, error) {
	a, err := scanApproval(t.tx.QueryRow(ctx,
		`SELECT `+approvalCols+` FROM backup.device_approvals WHERE id = $1::uuid FOR UPDATE`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return approvals.Approval{}, approvals.ErrNotFound
	}
	if err != nil {
		return approvals.Approval{}, fmt.Errorf("lock approval: %w", err)
	}
	return a, nil
}

// Decide implements approvals.Tx.
func (t approvalsTx) Decide(ctx context.Context, id string, s approvals.Status, at time.Time) error {
	_, err := t.tx.Exec(ctx, `UPDATE backup.device_approvals SET status = $2, decided_at = $3 WHERE id = $1::uuid`,
		id, string(s), at)
	if err != nil {
		return fmt.Errorf("decide approval: %w", err)
	}
	return nil
}

// Approve implements approvals.Tx.
func (t approvalsTx) Approve(ctx context.Context, id string, g approvals.Grant, at time.Time) error {
	_, err := t.tx.Exec(ctx, `UPDATE backup.device_approvals
		SET status = 'approved', ephemeral_public_key = $2, wrapped_dek = $3, nonce = $4, decided_at = $5
		WHERE id = $1::uuid`, id, g.EphemeralPublicKey, g.WrappedDEK, g.Nonce, at)
	if err != nil {
		return fmt.Errorf("approve approval: %w", err)
	}
	return nil
}

// ClearGrant implements approvals.Tx.
func (t approvalsTx) ClearGrant(ctx context.Context, id string) error {
	_, err := t.tx.Exec(ctx, `UPDATE backup.device_approvals
		SET ephemeral_public_key = NULL, wrapped_dek = NULL, nonce = NULL WHERE id = $1::uuid`, id)
	if err != nil {
		return fmt.Errorf("clear approval grant: %w", err)
	}
	return nil
}

// Open implements approvals.Repo.
func (r *ApprovalsRepo) Open(ctx context.Context, userID string, now time.Time) ([]approvals.Approval, error) {
	rows, err := r.pool.Query(ctx, `SELECT `+approvalCols+` FROM backup.device_approvals
		WHERE user_id = $1 AND status = 'pending' AND expires_at > $2 ORDER BY created_at DESC, id`, userID, now)
	if err != nil {
		return nil, fmt.Errorf("list open approvals: %w", err)
	}
	defer rows.Close()
	var out []approvals.Approval
	for rows.Next() {
		a, err := scanApproval(rows)
		if err != nil {
			return nil, fmt.Errorf("scan approval: %w", err)
		}
		out = append(out, a)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list open approvals: %w", err)
	}
	return out, nil
}
