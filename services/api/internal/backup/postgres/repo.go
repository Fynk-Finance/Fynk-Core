// Package postgres implements recovery.Repo on backup.recovery_keys with pgx.
package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/recovery"
)

// Repo is the pgx repository. Errors never carry keys or hashes.
type Repo struct{ pool *pgxpool.Pool }

// New returns a repository over pool (it may be nil until the first request).
func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

var _ recovery.Repo = (*Repo)(nil)

type kdfParams struct {
	MemoryKiB   int `json:"memoryKiB"`
	Iterations  int `json:"iterations"`
	Parallelism int `json:"parallelism"`
}

// Put implements recovery.Repo: one row per user, replaced on every call.
func (r *Repo) Put(ctx context.Context, userID string, k recovery.Key) error {
	params, err := json.Marshal(kdfParams{k.MemoryKiB, k.Iterations, k.Parallelism})
	if err != nil {
		return fmt.Errorf("put recovery key: %w", err)
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO backup.recovery_keys (user_id, wrapped_dek, nonce, salt, kdf, kdf_params, device_proof_hash, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (user_id) DO UPDATE SET wrapped_dek = EXCLUDED.wrapped_dek, nonce = EXCLUDED.nonce,
		  salt = EXCLUDED.salt, kdf = EXCLUDED.kdf, kdf_params = EXCLUDED.kdf_params,
		  device_proof_hash = EXCLUDED.device_proof_hash, created_at = EXCLUDED.created_at`,
		userID, k.WrappedDEK, k.Nonce, k.Salt, k.KDF, params, k.ProofHash, k.CreatedAt)
	if err != nil {
		return fmt.Errorf("put recovery key: %w", err)
	}
	return nil
}

// Get implements recovery.Repo.
func (r *Repo) Get(ctx context.Context, userID string) (recovery.Key, error) {
	var (
		k      recovery.Key
		params []byte
	)
	err := r.pool.QueryRow(ctx, `
		SELECT wrapped_dek, nonce, salt, kdf, kdf_params, device_proof_hash, created_at
		FROM backup.recovery_keys WHERE user_id = $1`, userID).
		Scan(&k.WrappedDEK, &k.Nonce, &k.Salt, &k.KDF, &params, &k.ProofHash, &k.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return recovery.Key{}, recovery.ErrNoKey
	}
	if err != nil {
		return recovery.Key{}, fmt.Errorf("get recovery key: %w", err)
	}
	var p kdfParams
	if err := json.Unmarshal(params, &p); err != nil {
		return recovery.Key{}, fmt.Errorf("get recovery key: %w", err)
	}
	k.MemoryKiB, k.Iterations, k.Parallelism = p.MemoryKiB, p.Iterations, p.Parallelism
	return k, nil
}
