//go:build integration

// Runs against a real Postgres: DATABASE_URL=postgres://... go test -tags integration ./internal/consents/store/
// make dev starts one on localhost:5432 (see docs/local-dev.md). It recreates the consents schema.
package store

import (
	"context"
	"encoding/hex"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
)

var t0 = time.Date(2026, 10, 27, 15, 0, 0, 0, time.UTC)

func open(t *testing.T) *Postgres {
	t.Helper()
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
	return New(pool)
}

func pendingConsent(t *testing.T, p *Postgres, id, user string) domain.Consent {
	t.Helper()
	text, err := p.CurrentText(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	c, err := domain.NewPending(id, domain.Request{
		UserID: user, DeviceID: "0192f0a0-0000-7000-8000-000000000001", Provider: "banco-demo",
		Scopes:   []domain.Scope{domain.ScopeBalances, domain.ScopeTransactions},
		Purpose:  domain.Purpose,
		TermDays: domain.TermDays, TextVersion: text.Version, TextSHA256: hex.EncodeToString(text.SHA256),
		AppVersion: "0.1.0", Locale: domain.Locale,
	}, []domain.Scope{domain.ScopeBalances, domain.ScopeTransactions, domain.ScopeAccountDetails}, text, t0)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func TestSeededTextHasItsOwnHash(t *testing.T) {
	p := open(t)
	text, err := p.CurrentText(context.Background())
	if err != nil || text.Version != "2026-10-v1" || len(text.SHA256) != 32 {
		t.Fatalf("text %+v, %v", text, err)
	}
	if _, err := p.TextByVersion(context.Background(), "1999-01-v0"); !errors.Is(err, domain.ErrUnknownTextVersion) {
		t.Fatalf("unknown version: %v", err)
	}
}

func TestConsentRoundTripGrantAndExpiry(t *testing.T) {
	p := open(t)
	ctx := context.Background()
	c := pendingConsent(t, p, "0192f0a0-0000-7000-8000-0000000000c1", "u1")
	stored, created, err := p.Insert(ctx, c, "")
	if err != nil || !created || stored.Evidence.TextSHA256 != c.Evidence.TextSHA256 || len(stored.Scopes) != 2 {
		t.Fatalf("Insert = %+v, %v, %v", stored, created, err)
	}
	text, _ := p.CurrentText(ctx)
	granted, err := stored.Grant("bd-1", text, t0.Add(time.Minute))
	if err != nil {
		t.Fatal(err)
	}
	if err := p.Activate(ctx, granted); err != nil {
		t.Fatal(err)
	}
	if err := p.Activate(ctx, granted); !errors.Is(err, domain.ErrNotPending) {
		t.Fatalf("second activate: %v", err)
	}
	got, err := p.Get(ctx, c.ID)
	if err != nil || got.Status != domain.StatusActive || !got.ExpiresAt.Equal(*granted.ExpiresAt) {
		t.Fatalf("Get = %+v, %v", got, err)
	}
	if list, _ := p.ExpireDue(ctx, got.ExpiresAt.Add(-time.Second)); len(list) != 0 {
		t.Fatal("expired before the term")
	}
	if list, _ := p.ExpireDue(ctx, *got.ExpiresAt); len(list) != 1 {
		t.Fatalf("expired %d at the term", len(list))
	}
	if list, _ := p.ExpireDue(ctx, *got.ExpiresAt); len(list) != 0 {
		t.Fatal("expired twice")
	}
}

func TestIdempotencyKeyIsPerUser(t *testing.T) {
	p := open(t)
	ctx := context.Background()
	first, _, _ := p.Insert(ctx, pendingConsent(t, p, "0192f0a0-0000-7000-8000-0000000000d1", "u1"), "k")
	again, created, err := p.Insert(ctx, pendingConsent(t, p, "0192f0a0-0000-7000-8000-0000000000d2", "u1"), "k")
	if err != nil || created || again.ID != first.ID {
		t.Fatalf("same user, same key: %v %v %v", again.ID, created, err)
	}
	if _, created, err := p.Insert(ctx, pendingConsent(t, p, "0192f0a0-0000-7000-8000-0000000000d3", "u2"), "k"); err != nil || !created {
		t.Fatalf("other user: %v %v", created, err)
	}
	list, _ := p.ListByUser(ctx, "u1")
	if len(list) != 1 {
		t.Fatalf("u1 has %d consents", len(list))
	}
}

func TestTheDatabaseRefusesAnActiveConsentWithoutItsGrant(t *testing.T) {
	p := open(t)
	ctx := context.Background()
	c := pendingConsent(t, p, "0192f0a0-0000-7000-8000-0000000000e1", "u1")
	_, _, _ = p.Insert(ctx, c, "")
	if _, err := p.db.Exec(ctx, `UPDATE consents.consents SET status = 'active' WHERE id = $1`, c.ID); err == nil {
		t.Fatal("an active consent without granted_at, expires_at and provider_consent_id was stored")
	}
	if _, err := p.db.Exec(ctx, `UPDATE consents.consents SET evidence = '{}' WHERE id = $1`, c.ID); err == nil {
		t.Fatal("a consent without evidence was stored")
	}
}

func TestGetOfANonUUIDIsNotFound(t *testing.T) {
	p := open(t)
	if _, err := p.Get(context.Background(), "not-a-uuid"); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func activeConsent(t *testing.T, p *Postgres, id string) domain.Consent {
	t.Helper()
	ctx := context.Background()
	c, _, err := p.Insert(ctx, pendingConsent(t, p, id, "u1"), "")
	if err != nil {
		t.Fatal(err)
	}
	text, _ := p.CurrentText(ctx)
	g, err := c.Grant("bd-"+id[30:], text, t0)
	if err != nil {
		t.Fatal(err)
	}
	if err := p.Activate(ctx, g); err != nil {
		t.Fatal(err)
	}
	return g
}

// HU-008: the revocation is stored at once and its notice is claimed by one job at a time.
func TestRevokeThenClaimAndConfirmTheNotice(t *testing.T) {
	p := open(t)
	ctx := context.Background()
	c := activeConsent(t, p, "0192f0a0-0000-7000-8000-0000000000f1")
	r, err := c.Revoke(domain.ReasonUserRequest, t0.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if err := p.MarkRevoked(ctx, r); err != nil {
		t.Fatal(err)
	}
	if err := p.MarkRevoked(ctx, r); !errors.Is(err, domain.ErrNotRevocable) {
		t.Fatalf("second revoke: %v", err)
	}
	if got, _ := p.Get(ctx, c.ID); got.Status != domain.StatusRevoked || got.RevokedReason != "user_request" || got.NextNotifyAt == nil {
		t.Fatalf("stored %+v", got)
	}
	due := *r.NextNotifyAt
	if list, _ := p.ClaimNotices(ctx, due.Add(-time.Second), due.Add(time.Hour), 10); len(list) != 0 {
		t.Fatal("claimed before it was due")
	}
	list, err := p.ClaimNotices(ctx, due, due.Add(10*time.Minute), 10)
	if err != nil || len(list) != 1 || list[0].ID != c.ID {
		t.Fatalf("claim %+v, %v", list, err)
	}
	if again, _ := p.ClaimNotices(ctx, due, due.Add(10*time.Minute), 10); len(again) != 0 {
		t.Fatal("the same notice was claimed twice")
	}
	if err := p.SaveNotice(ctx, list[0].Notified(due)); err != nil {
		t.Fatal(err)
	}
	got, _ := p.Get(ctx, c.ID)
	if got.ProviderNotifiedAt == nil || got.NextNotifyAt != nil || got.NotifyAttempts != 1 {
		t.Fatalf("after notice %+v", got)
	}
	if late, _ := p.ClaimNotices(ctx, due.Add(48*time.Hour), due.Add(49*time.Hour), 10); len(late) != 0 {
		t.Fatal("a confirmed notice was claimed again")
	}
}

func TestANoticeIsNotClaimedAfterTwentyFourHours(t *testing.T) {
	p := open(t)
	ctx := context.Background()
	c := activeConsent(t, p, "0192f0a0-0000-7000-8000-0000000000f2")
	r, _ := c.Revoke(domain.ReasonUserRequest, t0)
	_ = p.MarkRevoked(ctx, r)
	if list, _ := p.ClaimNotices(ctx, t0.Add(24*time.Hour), t0.Add(25*time.Hour), 10); len(list) != 0 {
		t.Fatal("claimed after the 24 hours")
	}
	if list, _ := p.ClaimNotices(ctx, t0.Add(23*time.Hour), t0.Add(24*time.Hour), 10); len(list) != 1 {
		t.Fatal("not claimed within the 24 hours")
	}
}

func TestTheDatabaseRefusesARevokedConsentWithoutItsDate(t *testing.T) {
	p := open(t)
	c := activeConsent(t, p, "0192f0a0-0000-7000-8000-0000000000f3")
	if _, err := p.db.Exec(context.Background(), `UPDATE consents.consents SET status = 'revoked' WHERE id = $1`, c.ID); err == nil {
		t.Fatal("a revoked consent without revoked_at was stored")
	}
}
