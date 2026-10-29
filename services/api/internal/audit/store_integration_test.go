//go:build integration

// Runs against a real Postgres: DATABASE_URL=postgres://... go test -tags integration ./internal/audit/
package audit_test

import (
	"context"
	"database/sql"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit"
	auditmigrations "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/db"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
)

func setupTestStore(t *testing.T) (*audit.Store, *sql.DB, context.Context) {
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

	if err := sqldb.PingContext(ctx); err != nil {
		t.Skipf("Postgres is not reachable at %s: %v", dbURL, err)
	}

	reset := func() { _, _ = sqldb.ExecContext(ctx, "DROP SCHEMA IF EXISTS audit CASCADE") }
	reset()
	t.Cleanup(reset)

	res, err := migrate.Up(ctx, dbURL, migrate.Source{Schema: "audit", FS: auditmigrations.FS})
	if err != nil || res.Version != 1 || res.Dirty {
		t.Fatalf("migrate: %+v, %v", res, err)
	}

	pool, err := db.Open(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	store := audit.New(pool, slog.Default(), clock.System{})
	return store, sqldb, ctx
}

func TestImmutabilityTriggerRejectsUpdateDeleteTruncate(t *testing.T) {
	store, sqldb, ctx := setupTestStore(t)

	err := store.Record(ctx, ports.Event{
		Type:     ports.AuthLogin,
		UserID:   "user-123",
		DeviceID: uuid.NewString(),
		At:       time.Now(),
		Meta:     map[string]string{"status": "ok"},
	})
	if err != nil {
		t.Fatalf("record: %v", err)
	}

	// 1. UPDATE must fail
	_, err = sqldb.ExecContext(ctx, "UPDATE audit.events SET type = 'tampered' WHERE id = 1")
	if err == nil {
		t.Fatal("expected UPDATE to fail due to trigger, but it succeeded")
	}

	// 2. DELETE must fail
	_, err = sqldb.ExecContext(ctx, "DELETE FROM audit.events WHERE id = 1")
	if err == nil {
		t.Fatal("expected DELETE to fail due to trigger, but it succeeded")
	}

	// 3. TRUNCATE must fail
	_, err = sqldb.ExecContext(ctx, "TRUNCATE audit.events")
	if err == nil {
		t.Fatal("expected TRUNCATE to fail due to trigger, but it succeeded")
	}
}

func TestHashChainAppendAndVerify(t *testing.T) {
	store, _, ctx := setupTestStore(t)

	// Empty store verification
	res, err := store.Verify(ctx)
	if err != nil {
		t.Fatalf("verify empty: %v", err)
	}
	if !res.Valid || res.Count != 0 {
		t.Fatalf("expected valid empty chain, got: %+v", res)
	}

	// Record 3 events
	devID := uuid.NewString()
	events := []ports.Event{
		{
			Type:     ports.DeviceRegistered,
			UserID:   "usr-1",
			DeviceID: devID,
			At:       time.Now().Add(-2 * time.Minute),
			Meta:     map[string]string{"platform": "ios", "status": "active"},
		},
		{
			Type:     ports.AuthLogin,
			UserID:   "usr-1",
			DeviceID: devID,
			At:       time.Now().Add(-1 * time.Minute),
			Meta:     map[string]string{"auth_method": "password", "status": "ok"},
		},
		{
			Type:     ports.ConsentGranted,
			UserID:   "usr-1",
			DeviceID: devID,
			At:       time.Now(),
			Meta:     map[string]string{"provider": "bancolombia", "institution_id": "banco-1"},
		},
	}

	for _, e := range events {
		if err := store.Record(ctx, e); err != nil {
			t.Fatalf("record %s: %v", e.Type, err)
		}
	}

	res, err = store.Verify(ctx)
	if err != nil {
		t.Fatalf("verify 3 events: %v", err)
	}
	if !res.Valid || res.Count != 3 || res.HeadHash == "" {
		t.Fatalf("expected valid 3 events, got: %+v", res)
	}
}

func TestHashChainTamperDetection(t *testing.T) {
	store, sqldb, ctx := setupTestStore(t)

	devID := uuid.NewString()
	for i := 0; i < 3; i++ {
		err := store.Record(ctx, ports.Event{
			Type:     ports.AuthLogin,
			UserID:   "usr-tamper",
			DeviceID: devID,
			At:       time.Now(),
			Meta:     map[string]string{"status": "ok"},
		})
		if err != nil {
			t.Fatalf("record %d: %v", i, err)
		}
	}

	// Disable trigger to simulate low-level database tampering
	_, err := sqldb.ExecContext(ctx, "ALTER TABLE audit.events DISABLE TRIGGER trg_prevent_event_modification")
	if err != nil {
		t.Fatalf("disable trigger: %v", err)
	}

	// Tamper with row 2's hash
	_, err = sqldb.ExecContext(ctx, "UPDATE audit.events SET hash = decode('0000000000000000000000000000000000000000000000000000000000000000', 'hex') WHERE id = 2")
	if err != nil {
		t.Fatalf("tamper hash: %v", err)
	}

	res, err := store.Verify(ctx)
	if err == nil || res.Valid {
		t.Fatalf("expected verify to detect tampering, but got valid: %+v", res)
	}
	if res.BrokenAtID != 2 {
		t.Fatalf("expected broken at row 2, got: %+v", res)
	}
}

func TestHashChainRowDeletionDetection(t *testing.T) {
	store, sqldb, ctx := setupTestStore(t)

	devID := uuid.NewString()
	for i := 0; i < 3; i++ {
		err := store.Record(ctx, ports.Event{
			Type:     ports.AuthLogin,
			UserID:   "usr-delete",
			DeviceID: devID,
			At:       time.Now(),
			Meta:     map[string]string{"status": "ok"},
		})
		if err != nil {
			t.Fatalf("record %d: %v", i, err)
		}
	}

	// Disable trigger to simulate unauthorized row deletion
	_, err := sqldb.ExecContext(ctx, "ALTER TABLE audit.events DISABLE TRIGGER trg_prevent_event_modification")
	if err != nil {
		t.Fatalf("disable trigger: %v", err)
	}

	// Delete row 2
	_, err = sqldb.ExecContext(ctx, "DELETE FROM audit.events WHERE id = 2")
	if err != nil {
		t.Fatalf("delete row: %v", err)
	}

	res, err := store.Verify(ctx)
	if err == nil || res.Valid {
		t.Fatalf("expected verify to detect missing row in chain, but got valid: %+v", res)
	}
	if res.BrokenAtID != 3 {
		t.Fatalf("expected broken at row 3 (prev_hash mismatch), got: %+v", res)
	}
}
