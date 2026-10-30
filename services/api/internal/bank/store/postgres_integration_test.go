//go:build integration

// Runs against a real Postgres: DATABASE_URL=postgres://... go test -tags integration ./internal/bank/store/
package store

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
)

func TestPostgresStore(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	if _, err := migrate.Up(ctx, dbURL, migrate.Source{Schema: "bank", FS: migrations.FS}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx, `DELETE FROM bank.links`); err != nil {
		t.Fatal(err)
	}
	run := time.Now().UnixNano() % 1_000_000
	testStore(t, New(pool), func(n int) string {
		return fmt.Sprintf("00000000-0000-4000-8000-%06d%06d", run, n)
	})
}

func TestTheDatabaseRefusesARevokedLinkWithoutItsDate(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx := context.Background()
	if _, err := migrate.Up(ctx, dbURL, migrate.Source{Schema: "bank", FS: migrations.FS}); err != nil {
		t.Fatal(err)
	}
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	_, err = pool.Exec(ctx, `INSERT INTO bank.links (id, user_id, device_id, provider, consent_id,
		token_fingerprint, status, created_at) VALUES (gen_random_uuid(), 'u', gen_random_uuid(),
		'banco-demo', gen_random_uuid(), $1, 'revoked', now())`, fp(1))
	if err == nil {
		t.Fatal("a revoked link without revoked_at must be refused")
	}
}
