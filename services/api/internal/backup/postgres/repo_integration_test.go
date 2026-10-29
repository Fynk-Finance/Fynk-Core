//go:build integration

// Runs against a real Postgres: DATABASE_URL=postgres://... go test -tags integration ./internal/backup/postgres/
package postgres_test

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/postgres"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/recovery"
	idmigrations "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/db"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
)

// setup migrates the backup and identity schemas from scratch and returns a pool.
func setup(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx := context.Background()
	sqldb, err := sql.Open("pgx", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqldb.Close() })
	reset := func() {
		_, _ = sqldb.ExecContext(ctx, "DROP SCHEMA IF EXISTS backup CASCADE")
		_, _ = sqldb.ExecContext(ctx, "DROP SCHEMA IF EXISTS identity CASCADE")
	}
	reset()
	t.Cleanup(reset)
	for _, src := range []migrate.Source{{Schema: "backup", FS: migrations.FS}, {Schema: "identity", FS: idmigrations.FS}} {
		want := uint(1)
		if src.Schema == "backup" {
			want = 2
		}
		if res, err := migrate.Up(ctx, dbURL, src); err != nil || uint(res.Version) != want || res.Dirty {
			t.Fatalf("migrate %s: %+v, %v", src.Schema, res, err)
		}
	}
	pool, err := db.Open(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func TestRecoveryKeyOnPostgres(t *testing.T) {
	repo := postgres.New(setup(t))
	ctx := context.Background()
	if _, err := repo.Get(ctx, "u1"); !errors.Is(err, recovery.ErrNoKey) {
		t.Fatalf("empty: %v", err)
	}
	at := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	key := func(b byte) recovery.Key {
		return recovery.Key{WrappedDEK: bytes.Repeat([]byte{b}, 48), Nonce: bytes.Repeat([]byte{b}, 12), Salt: bytes.Repeat([]byte{b}, 16),
			KDF: recovery.KDF, MemoryKiB: 65536, Iterations: 3, Parallelism: 1, ProofHash: bytes.Repeat([]byte{b}, 32), CreatedAt: at}
	}
	if err := repo.Put(ctx, "u1", key(1)); err != nil {
		t.Fatal(err)
	}
	if err := repo.Put(ctx, "u2", key(9)); err != nil {
		t.Fatal(err)
	}
	// The second Put replaces the first: the old key is gone.
	second := key(2)
	second.CreatedAt = at.Add(time.Hour)
	if err := repo.Put(ctx, "u1", second); err != nil {
		t.Fatal(err)
	}
	got, err := repo.Get(ctx, "u1")
	if err != nil || !bytes.Equal(got.WrappedDEK, second.WrappedDEK) || !bytes.Equal(got.ProofHash, second.ProofHash) ||
		got.MemoryKiB != 65536 || got.Iterations != 3 || got.Parallelism != 1 || got.KDF != "argon2id" || !got.CreatedAt.Equal(second.CreatedAt) {
		t.Fatalf("got %+v, %v", got, err)
	}
	if other, _ := repo.Get(ctx, "u2"); !bytes.Equal(other.WrappedDEK, key(9).WrappedDEK) {
		t.Fatal("another user's key changed")
	}
	// The table rejects a wrong size.
	bad := key(3)
	bad.Salt = bad.Salt[:15]
	if err := repo.Put(ctx, "u3", bad); err == nil {
		t.Fatal("a 15 byte salt was stored")
	}
}
