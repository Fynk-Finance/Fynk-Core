//go:build integration

// Runs against a real Postgres: DATABASE_URL=postgres://... go test -tags integration ./internal/identity/postgres/
package postgres_test

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/postgres"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/db"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
)

type nopAudit struct{}

func (nopAudit) Record(context.Context, audit.Event) error { return nil }

func setup(t *testing.T) (*devices.Service, ports.Activator, *sql.DB) {
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
	reset := func() { _, _ = sqldb.ExecContext(ctx, "DROP SCHEMA IF EXISTS identity CASCADE") }
	reset()
	t.Cleanup(reset)
	res, err := migrate.Up(ctx, dbURL, migrate.Source{Schema: "identity", FS: migrations.FS})
	if err != nil || res.Version != 1 || res.Dirty {
		t.Fatalf("migrate: %+v, %v", res, err)
	}
	pool, err := db.Open(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	clk := clock.System{}
	return devices.NewService(postgres.New(pool), clk, nopAudit{}, nil), ports.NewDevices(pool, clk), sqldb
}

func key(b byte) []byte { return bytes.Repeat([]byte{b}, 32) }

func reg(b byte) devices.RegisterInput {
	return devices.RegisterInput{Name: "Pixel", Platform: devices.PlatformAndroid, PublicKey: key(b)}
}

func TestDevicesOnPostgres(t *testing.T) {
	svc, act, _ := setup(t)
	ctx := context.Background()
	u1 := auth.User{ID: "u1", SessionID: "sid-1"}

	a, created, err := svc.Register(ctx, u1, reg(1), "idem-1")
	if err != nil || !created || a.Status != devices.StatusActive || a.SessionID != "sid-1" {
		t.Fatalf("first: %+v created=%v err=%v", a, created, err)
	}
	// Idempotency key returns the same row, even with another body.
	again, created, err := svc.Register(ctx, u1, reg(9), "idem-1")
	if err != nil || created || again.ID != a.ID {
		t.Fatalf("idempotency: created=%v err=%v", created, err)
	}
	// Same public key returns the existing device.
	same, created, err := svc.Register(ctx, u1, reg(1), "")
	if err != nil || created || same.ID != a.ID {
		t.Fatalf("same key: created=%v err=%v", created, err)
	}
	b, created, err := svc.Register(ctx, auth.User{ID: "u1"}, reg(2), "")
	if err != nil || !created || b.Status != devices.StatusPending || b.SessionID != "" {
		t.Fatalf("second: %+v err=%v", b, err)
	}

	// Another user never sees them.
	if _, err := svc.Current(ctx, auth.User{ID: "u2"}, a.ID); !errors.Is(err, devices.ErrNotFound) {
		t.Fatalf("other user: %v", err)
	}
	if ok, err := svc.Usable(ctx, "u2", a.ID); err != nil || ok {
		t.Fatalf("usable other user: %v %v", ok, err)
	}
	if _, err := svc.Remove(ctx, "u2", a.ID, a.ID); !errors.Is(err, devices.ErrNotFound) {
		t.Fatalf("remove other user: %v", err)
	}
	if _, err := svc.Current(ctx, u1, "not-a-uuid"); !errors.Is(err, devices.ErrNotFound) {
		t.Fatalf("malformed id: %v", err)
	}

	// Current updates last seen and the session.
	time.Sleep(10 * time.Millisecond)
	cur, err := svc.Current(ctx, auth.User{ID: "u1", SessionID: "sid-new"}, b.ID)
	if err != nil || cur.SessionID != "sid-new" || !cur.LastSeenAt.After(b.LastSeenAt) {
		t.Fatalf("current: %+v err=%v", cur, err)
	}
	list, err := svc.List(ctx, "u1")
	if err != nil || len(list) != 2 || list[0].ID != b.ID {
		t.Fatalf("list: %v err=%v", list, err)
	}
	if string(list[1].PublicKey) != string(key(1)) || list[1].Name != "Pixel" {
		t.Fatal("round trip lost data")
	}

	// ActivateDevice.
	if err := act.ActivateDevice(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	if err := act.ActivateDevice(ctx, b.ID); err != nil {
		t.Fatalf("already active: %v", err)
	}
	if err := act.ActivateDevice(ctx, "00000000-0000-4000-8000-000000000000"); !errors.Is(err, ports.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}

	// Remove, then ErrRemoved and ErrKeyRemoved.
	sid, err := svc.Remove(ctx, "u1", a.ID, a.ID)
	if err != nil || sid != "sid-1" {
		t.Fatalf("remove: %q %v", sid, err)
	}
	if sid, err := svc.Remove(ctx, "u1", a.ID, a.ID); err != nil || sid != "" {
		t.Fatalf("remove twice: %q %v", sid, err)
	}
	if _, err := svc.Current(ctx, u1, a.ID); !errors.Is(err, devices.ErrRemoved) {
		t.Fatalf("current removed: %v", err)
	}
	if err := act.ActivateDevice(ctx, a.ID); !errors.Is(err, ports.ErrRemoved) {
		t.Fatalf("activate removed: %v", err)
	}
	if ok, _ := svc.Usable(ctx, "u1", a.ID); ok {
		t.Fatal("removed device is usable")
	}
	if _, _, err := svc.Register(ctx, u1, reg(1), ""); !errors.Is(err, devices.ErrKeyRemoved) {
		t.Fatalf("removed key: %v", err)
	}

	// RemoveOthers keeps only the current device.
	c, _, _ := svc.Register(ctx, auth.User{ID: "u1", SessionID: "sid-c"}, reg(3), "")
	if _, err := svc.RemoveOthers(ctx, "u1", c.ID); !errors.Is(err, devices.ErrNotActive) {
		t.Fatalf("pending caller removing others: %v", err)
	}
	if _, err := svc.Remove(ctx, "u1", c.ID, b.ID); !errors.Is(err, devices.ErrNotActive) {
		t.Fatalf("pending caller removing another device: %v", err)
	}
	if err := act.ActivateDevice(ctx, c.ID); err != nil {
		t.Fatal(err)
	}
	sids, err := svc.RemoveOthers(ctx, "u1", c.ID)
	if err != nil || len(sids) != 1 || sids[0] != "sid-new" {
		t.Fatalf("remove others: %v %v", sids, err)
	}
	if list, _ := svc.List(ctx, "u1"); len(list) != 1 || list[0].ID != c.ID {
		t.Fatalf("after remove others: %v", list)
	}
}

func TestConcurrentFirstRegistrationsMakeOneActiveDevice(t *testing.T) {
	svc, _, sqldb := setup(t)
	ctx := context.Background()
	var wg sync.WaitGroup
	errs := make(chan error, 10)
	for i := 1; i <= 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, _, err := svc.Register(ctx, auth.User{ID: "racer"}, reg(byte(i)), fmt.Sprintf("k%d", i))
			errs <- err
		}(i)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	var active, total int
	err := sqldb.QueryRowContext(ctx,
		`SELECT count(*) FILTER (WHERE status = 'active'), count(*) FROM identity.devices WHERE user_id = 'racer'`).Scan(&active, &total)
	if err != nil || active != 1 || total != 10 {
		t.Fatalf("active=%d total=%d err=%v", active, total, err)
	}
}
