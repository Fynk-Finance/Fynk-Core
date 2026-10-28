// Package postgres implements devices.Repo on the identity.devices table with pgx.
package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
)

// Repo is the pgx repository. Errors never carry the device name or key.
type Repo struct {
	pool *pgxpool.Pool
}

// New returns a repository over pool.
func New(pool *pgxpool.Pool) *Repo { return &Repo{pool: pool} }

var _ devices.Repo = (*Repo)(nil)

// querier is what both the pool and a transaction offer.
type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
}

const cols = `id::text, user_id, name, platform, public_key, status, coalesce(session_id, ''), created_at, last_seen_at`

func scan(row pgx.Row) (devices.Device, error) {
	var d devices.Device
	var platform, status string
	err := row.Scan(&d.ID, &d.UserID, &d.Name, &platform, &d.PublicKey, &status, &d.SessionID, &d.CreatedAt, &d.LastSeenAt)
	d.Platform, d.Status = devices.Platform(platform), devices.Status(status)
	return d, err
}

// store holds the queries, over the pool or a transaction. lock adds FOR UPDATE.
type store struct {
	q    querier
	lock string
}

// validID reports whether id can be a device id. A malformed id is a device that is not found.
func validID(id string) bool { return uuid.Validate(id) == nil }

func (s store) Get(ctx context.Context, userID, id string) (devices.Device, error) {
	if !validID(id) {
		return devices.Device{}, devices.ErrNotFound
	}
	d, err := scan(s.q.QueryRow(ctx,
		`SELECT `+cols+` FROM identity.devices WHERE user_id = $1 AND id = $2::uuid`+s.lock, userID, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return devices.Device{}, devices.ErrNotFound
	}
	return d, wrap("get device", err)
}

func (s store) List(ctx context.Context, userID string) ([]devices.Device, error) {
	rows, err := s.q.Query(ctx,
		`SELECT `+cols+` FROM identity.devices WHERE user_id = $1 AND status <> 'removed'
		 ORDER BY last_seen_at DESC, created_at DESC, id`+s.lock, userID)
	if err != nil {
		return nil, wrap("list devices", err)
	}
	defer rows.Close()
	var out []devices.Device
	for rows.Next() {
		d, err := scan(rows)
		if err != nil {
			return nil, wrap("list devices", err)
		}
		out = append(out, d)
	}
	return out, wrap("list devices", rows.Err())
}

func (s store) optional(ctx context.Context, what, where string, args ...any) (devices.Device, bool, error) {
	d, err := scan(s.q.QueryRow(ctx, `SELECT `+cols+` FROM identity.devices WHERE `+where+s.lock, args...))
	if errors.Is(err, pgx.ErrNoRows) {
		return devices.Device{}, false, nil
	}
	return d, err == nil, wrap(what, err)
}

func (s store) ByIdempotencyKey(ctx context.Context, userID, key string) (devices.Device, bool, error) {
	return s.optional(ctx, "find device by idempotency key", `user_id = $1 AND idempotency_key = $2`, userID, key)
}

func (s store) ByPublicKey(ctx context.Context, userID string, key []byte) (devices.Device, bool, error) {
	return s.optional(ctx, "find device by public key", `user_id = $1 AND public_key = $2`, userID, key)
}

func (s store) HasActive(ctx context.Context, userID string) (bool, error) {
	var ok bool
	err := s.q.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM identity.devices WHERE user_id = $1 AND status = 'active')`, userID).Scan(&ok)
	return ok, wrap("check active device", err)
}

func (s store) Insert(ctx context.Context, d devices.Device, idempotencyKey string) error {
	_, err := s.q.Exec(ctx,
		`INSERT INTO identity.devices
		   (id, user_id, name, platform, public_key, status, session_id, idempotency_key, created_at, last_seen_at)
		 VALUES ($1::uuid, $2, $3, $4, $5, $6, nullif($7, ''), nullif($8, ''), $9, $10)`,
		d.ID, d.UserID, d.Name, string(d.Platform), d.PublicKey, string(d.Status), d.SessionID,
		idempotencyKey, d.CreatedAt, d.LastSeenAt)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return devices.ErrDuplicate
	}
	return wrap("insert device", err)
}

func (s store) Update(ctx context.Context, d devices.Device) error {
	tag, err := s.q.Exec(ctx,
		`UPDATE identity.devices SET status = $3, session_id = nullif($4, ''), last_seen_at = $5
		 WHERE user_id = $1 AND id = $2::uuid`,
		d.UserID, d.ID, string(d.Status), d.SessionID, d.LastSeenAt)
	if err != nil {
		return wrap("update device", err)
	}
	if tag.RowsAffected() == 0 {
		return devices.ErrNotFound
	}
	return nil
}

// wrap hides pgx's message, which can echo bound values, behind the operation name.
func wrap(what string, err error) error {
	if err == nil {
		return nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return fmt.Errorf("%s: postgres error %s", what, pgErr.Code)
	}
	return fmt.Errorf("%s: %w", what, err)
}

// Get implements devices.Repo.
func (r *Repo) Get(ctx context.Context, userID, id string) (devices.Device, error) {
	return store{q: r.pool}.Get(ctx, userID, id)
}

// List implements devices.Repo.
func (r *Repo) List(ctx context.Context, userID string) ([]devices.Device, error) {
	return store{q: r.pool}.List(ctx, userID)
}

// InTx implements devices.Repo.
func (r *Repo) InTx(ctx context.Context, userID string, fn func(devices.Tx) error) (err error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return wrap("begin", err)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('identity.devices:' || $1::text))`, userID); err != nil {
		return wrap("lock user devices", err)
	}
	if err = fn(store{q: tx, lock: " FOR UPDATE"}); err != nil {
		return err
	}
	return wrap("commit", tx.Commit(ctx))
}

// Activate implements devices.Repo.
func (r *Repo) Activate(ctx context.Context, id string) error {
	if !validID(id) {
		return devices.ErrNotFound
	}
	var status string
	err := r.pool.QueryRow(ctx,
		`UPDATE identity.devices SET status = 'active' WHERE id = $1::uuid AND status = 'pending' RETURNING status`, id).Scan(&status)
	if err == nil {
		return nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return wrap("activate device", err)
	}
	err = r.pool.QueryRow(ctx, `SELECT status FROM identity.devices WHERE id = $1::uuid`, id).Scan(&status)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return devices.ErrNotFound
	case err != nil:
		return wrap("activate device", err)
	case status == string(devices.StatusRemoved):
		return devices.ErrRemoved
	}
	return nil
}
