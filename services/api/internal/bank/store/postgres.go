// Package store keeps bank links in the Postgres schema bank, and in memory for tests.
package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/link"
)

// Postgres implements link.Store.
type Postgres struct {
	db *pgxpool.Pool
}

var _ link.Store = (*Postgres)(nil)

// New returns the store.
func New(db *pgxpool.Pool) *Postgres { return &Postgres{db: db} }

// Insert implements link.Store.
func (p *Postgres) Insert(ctx context.Context, l link.Link) error {
	_, err := p.db.Exec(ctx, `INSERT INTO bank.links
		(id, user_id, device_id, provider, consent_id, token_fingerprint, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, 'active', $7)`,
		l.ID, l.UserID, l.DeviceID, l.Provider, l.ConsentID, l.TokenFingerprint, l.CreatedAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return link.ErrConsentLinked
	}
	if err != nil {
		return fmt.Errorf("bank: insert link: %w", err)
	}
	return nil
}

// Get implements link.Store.
func (p *Postgres) Get(ctx context.Context, id string) (link.Link, error) {
	var l link.Link
	var status string
	err := p.db.QueryRow(ctx, `SELECT id::text, user_id, device_id::text, provider, consent_id::text,
		token_fingerprint, status, created_at, last_refreshed_at, revoked_at
		FROM bank.links WHERE id = $1`, id).Scan(&l.ID, &l.UserID, &l.DeviceID, &l.Provider,
		&l.ConsentID, &l.TokenFingerprint, &status, &l.CreatedAt, &l.LastRefreshedAt, &l.RevokedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return link.Link{}, link.ErrNotFound
	}
	if err != nil {
		return link.Link{}, fmt.Errorf("bank: read link: %w", err)
	}
	l.Status = link.Status(status)
	return l, nil
}

// Rotate implements link.Store with one conditional update, so it is atomic.
func (p *Postgres) Rotate(ctx context.Context, id string, old, next []byte, at time.Time) error {
	tag, err := p.db.Exec(ctx, `UPDATE bank.links SET token_fingerprint = $3, last_refreshed_at = $4
		WHERE id = $1 AND token_fingerprint = $2 AND status = 'active'`, id, old, next, at)
	if err != nil {
		return fmt.Errorf("bank: rotate link: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return link.ErrStale
	}
	return nil
}

// Revoke implements link.Store.
func (p *Postgres) Revoke(ctx context.Context, id string, at time.Time) error {
	if _, err := p.db.Exec(ctx, `UPDATE bank.links SET status = 'revoked', revoked_at = $2
		WHERE id = $1 AND status = 'active'`, id, at); err != nil {
		return fmt.Errorf("bank: revoke link: %w", err)
	}
	return nil
}
