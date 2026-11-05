//go:build integration

// Runs against a real Postgres: DATABASE_URL=postgres://... go test -tags integration ./internal/consents/ports/
// It recreates the consents schema. This is the path M13's account deletion takes (Ley 1581).
package ports

import (
	"context"
	"encoding/hex"
	"io"
	"log/slog"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	bankports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/service"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/store"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

type auditLog struct {
	mu     sync.Mutex
	events []audit.Event
}

func (a *auditLog) Record(_ context.Context, e audit.Event) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.events = append(a.events, e)
	return nil
}

type bankNotices struct {
	mu    sync.Mutex
	calls []string
}

func (b *bankNotices) RevokeConsent(_ context.Context, provider, providerConsentID string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.calls = append(b.calls, provider+"/"+providerConsentID)
	return nil
}

func TestRevokeAllEndsTheUsersConsentsInPostgres(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx, "DROP SCHEMA IF EXISTS consents CASCADE"); err != nil {
		t.Fatal(err)
	}
	if _, err := migrate.Up(ctx, dbURL, migrate.Source{Schema: "consents", FS: migrations.FS}); err != nil {
		t.Fatal(err)
	}
	bank := &bankNotices{}
	bankports.InstallRevoker(bank)
	t.Cleanup(func() { bankports.InstallRevoker(nil) })

	rec := &auditLog{}
	clk := clock.NewFixed(time.Date(2026, 11, 5, 15, 0, 0, 0, time.UTC))
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	svc := service.New(store.New(pool), clk, rec, log, service.BankRevoker{})
	text, err := svc.CurrentText(ctx)
	if err != nil {
		t.Fatal(err)
	}
	newConsent := func(user string) domain.Consent {
		c, err := svc.Create(ctx, domain.Request{
			UserID: user, DeviceID: "0192f0a0-0000-7000-8000-000000000001", Provider: "banco-demo",
			Scopes:   []domain.Scope{domain.ScopeBalances, domain.ScopeTransactions},
			Purpose:  domain.Purpose,
			TermDays: domain.TermDays, TextVersion: text.Version, TextSHA256: hex.EncodeToString(text.SHA256),
			AppVersion: "0.1.0", Locale: domain.Locale,
		}, "")
		if err != nil {
			t.Fatal(err)
		}
		return c
	}
	active := newConsent("u1")
	if err := svc.MarkGranted(ctx, active.ID, "bd-active"); err != nil {
		t.Fatal(err)
	}
	pending := newConsent("u1")
	other := newConsent("u2")

	revoker := NewConsentsRevoker(module.Deps{DB: pool, Audit: rec, Clock: clk, Log: log})
	if err := revoker.RevokeAll(ctx, "u1"); err != nil {
		t.Fatal(err)
	}

	for _, c := range []domain.Consent{active, pending} {
		got, err := svc.Get(ctx, "u1", c.ID)
		if err != nil || got.Status != domain.StatusRevoked || got.RevokedReason != domain.ReasonAccountDeleted {
			t.Fatalf("%s: %+v, %v", c.ID, got, err)
		}
	}
	if got, _ := svc.Get(ctx, "u2", other.ID); got.Status != domain.StatusPending {
		t.Fatalf("another user's consent became %s", got.Status)
	}
	if len(bank.calls) != 1 || bank.calls[0] != "banco-demo/bd-active" {
		t.Fatalf("bank notices %v", bank.calls)
	}
	if got, _ := svc.Get(ctx, "u1", active.ID); got.ProviderNotifiedAt == nil {
		t.Fatal("the entity notice was not stored")
	}
	revoked := 0
	for _, e := range rec.events {
		if e.Type == audit.ConsentRevoked {
			revoked++
		}
	}
	if revoked != 2 {
		t.Fatalf("%d consent.revoked events, want 2", revoked)
	}
}
