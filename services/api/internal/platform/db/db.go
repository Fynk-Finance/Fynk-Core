// Package db opens the Postgres connection pool shared by every backend module.
// Each module owns one schema with its own name (shared contracts, section 4.1).
package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Open parses url and returns a pool. It does not connect until first use, so the API can
// start while Postgres is down; /readyz reports it.
func Open(ctx context.Context, url string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		// The parse error can echo the URL, which holds the password: keep it out.
		return nil, fmt.Errorf("db: invalid DATABASE_URL")
	}
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("db: create pool: %w", err)
	}
	return pool, nil
}
