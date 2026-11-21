package postgres

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/records"
)

// RecordsRepo implements records.Repo on backup.records. Errors never carry record data.
type RecordsRepo struct{ pool *pgxpool.Pool }

// NewRecords returns a repository over pool (it may be nil until the first request).
func NewRecords(pool *pgxpool.Pool) *RecordsRepo { return &RecordsRepo{pool: pool} }

var _ records.Repo = (*RecordsRepo)(nil)

const lockSQL = `SELECT pg_advisory_xact_lock(hashtext('backup.records:' || $1::text))`

type recordsTx struct{ tx pgx.Tx }

// InTx implements records.Repo: the user's lock is held until commit or rollback.
func (r *RecordsRepo) InTx(ctx context.Context, userID string, fn func(records.Tx) error) (err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin records tx: %w", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()
	if _, err = tx.Exec(ctx, lockSQL, userID); err != nil {
		return fmt.Errorf("lock user records: %w", err)
	}
	if err = fn(recordsTx{tx}); err != nil {
		return err
	}
	if err = tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit records: %w", err)
	}
	return nil
}

// Upsert implements records.Tx. The WHERE keeps a higher stored version untouched.
func (t recordsTx) Upsert(ctx context.Context, userID string, e records.Envelope, at time.Time) (bool, error) {
	tag, err := t.tx.Exec(ctx, `
		INSERT INTO backup.records (user_id, collection, record_id, version, deleted, nonce, ciphertext, updated_at, seq)
		VALUES ($1, $2, $3::uuid, $4, $5, $6, $7, $8, nextval('backup.records_seq'))
		ON CONFLICT (user_id, collection, record_id) DO UPDATE SET version = EXCLUDED.version,
		  deleted = EXCLUDED.deleted, nonce = EXCLUDED.nonce, ciphertext = EXCLUDED.ciphertext,
		  updated_at = EXCLUDED.updated_at, seq = nextval('backup.records_seq')
		WHERE backup.records.version <= EXCLUDED.version`,
		userID, e.Collection, e.RecordID, e.Version, e.Deleted, e.Nonce, e.Ciphertext, at)
	if err != nil {
		return false, fmt.Errorf("upsert record: %w", err)
	}
	return tag.RowsAffected() == 1, nil
}

// Usage implements records.Tx.
func (t recordsTx) Usage(ctx context.Context, userID string) (int64, error) {
	var n int64
	err := t.tx.QueryRow(ctx, `SELECT coalesce(sum(octet_length(ciphertext) + octet_length(nonce)), 0)::bigint
		FROM backup.records WHERE user_id = $1`, userID).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("record usage: %w", err)
	}
	return n, nil
}

// After implements records.Repo. It reads under the same lock as the writers (in a read
// transaction), so a row committed later always gets a higher seq than any row returned.
func (r *RecordsRepo) After(ctx context.Context, userID string, after int64, limit int) ([]records.Stored, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, fmt.Errorf("begin records read: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if _, err = tx.Exec(ctx, lockSQL, userID); err != nil {
		return nil, fmt.Errorf("lock user records: %w", err)
	}
	rows, err := tx.Query(ctx, `
		SELECT collection, record_id::text, version, deleted, nonce, ciphertext, updated_at, seq
		FROM backup.records WHERE user_id = $1 AND seq > $2 ORDER BY seq LIMIT $3`, userID, after, limit)
	if err != nil {
		return nil, fmt.Errorf("list records: %w", err)
	}
	defer rows.Close()
	var out []records.Stored
	for rows.Next() {
		var s records.Stored
		if err := rows.Scan(&s.Collection, &s.RecordID, &s.Version, &s.Deleted, &s.Nonce, &s.Ciphertext, &s.UpdatedAt, &s.Seq); err != nil {
			return nil, fmt.Errorf("scan record: %w", err)
		}
		out = append(out, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("list records: %w", err)
	}
	return out, nil
}
