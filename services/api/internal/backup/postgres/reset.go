package postgres

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/reset"
)

// ResetRepo implements reset.Repo. Errors never carry record data.
type ResetRepo struct{ pool *pgxpool.Pool }

// NewReset returns a repository over pool (it may be nil until the first request).
func NewReset(pool *pgxpool.Pool) *ResetRepo { return &ResetRepo{pool: pool} }

var _ reset.Repo = (*ResetRepo)(nil)

// DeleteBackup implements reset.Repo. It takes the records lock and then the approvals lock,
// the two writers of the user, so no upload or approval is half done while the rows go.
func (r *ResetRepo) DeleteBackup(ctx context.Context, userID string) (err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin reset tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()
	for _, q := range []string{lockSQL, approvalsLockSQL} {
		if _, err = tx.Exec(ctx, q, userID); err != nil {
			return fmt.Errorf("lock user backup: %w", err)
		}
	}
	for _, table := range []string{"backup.records", "backup.recovery_keys", "backup.device_approvals"} {
		if _, err = tx.Exec(ctx, `DELETE FROM `+table+` WHERE user_id = $1`, userID); err != nil {
			return fmt.Errorf("delete %s: %w", table, err)
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit reset: %w", err)
	}
	return nil
}
