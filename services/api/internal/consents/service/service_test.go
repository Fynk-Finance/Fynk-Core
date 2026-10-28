package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/store"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var (
	t0   = time.Date(2026, 10, 27, 15, 0, 0, 0, time.UTC)
	body = "# Autorización para compartir tus datos con Fynk\n"
	sum  = sha256.Sum256([]byte(body))
	text = domain.Text{Version: "2026-10-v1", BodyMD: body, SHA256: sum[:], PublishedAt: t0}
)

const device = "0192f0a0-0000-7000-8000-000000000001"

type recorder struct {
	mu     sync.Mutex
	events []audit.Event
	err    error
}

func (r *recorder) Record(_ context.Context, e audit.Event) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.events = append(r.events, e)
	return r.err
}

func (r *recorder) types() []string {
	r.mu.Lock()
	defer r.mu.Unlock()
	var out []string
	for _, e := range r.events {
		out = append(out, e.Type)
	}
	return out
}

func setup(t *testing.T) (*Service, *store.Memory, *recorder, *clock.Fixed) {
	t.Helper()
	st := store.NewMemory(text)
	rec := &recorder{}
	clk := clock.NewFixed(t0)
	return New(st, clk, rec, slog.New(slog.NewTextHandler(io.Discard, nil))), st, rec, clk
}

func request(user string) domain.Request {
	return domain.Request{
		UserID: user, DeviceID: device, Provider: "banco-demo",
		Scopes:      []domain.Scope{domain.ScopeBalances, domain.ScopeTransactions, domain.ScopeAccountDetails},
		Purpose:     domain.Purpose,
		TermDays:    domain.TermDays,
		TextVersion: text.Version, TextSHA256: hex.EncodeToString(sum[:]),
		AppVersion: "0.1.0", Locale: domain.Locale,
	}
}

func create(t *testing.T, s *Service, user string) domain.Consent {
	t.Helper()
	c, err := s.Create(context.Background(), request(user), "")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	return c
}

func TestCurrentTextIsTheSeededVersion(t *testing.T) {
	s, _, _, _ := setup(t)
	got, err := s.CurrentText(context.Background())
	if err != nil || got.Version != "2026-10-v1" {
		t.Fatalf("CurrentText = %+v, %v", got, err)
	}
}

// HU-006: the acceptance is stored explicitly as a pending consent with its evidence.
func TestCreateStoresAPendingConsentWithEvidence(t *testing.T) {
	s, st, _, _ := setup(t)
	c := create(t, s, "u1")
	stored, _ := st.Get(context.Background(), c.ID)
	if stored.Status != domain.StatusPending || stored.Evidence.AcceptedAt.IsZero() || stored.UserID != "u1" {
		t.Fatalf("stored %+v", stored)
	}
	if !strings.HasPrefix(c.ID[14:], "7") || len(c.ID) != 36 {
		t.Fatalf("id %q is not a UUID v7", c.ID)
	}
}

func TestCreateWithAnUnknownTextVersionFails(t *testing.T) {
	s, _, _, _ := setup(t)
	r := request("u1")
	r.TextVersion = "2025-01-v0"
	if _, err := s.Create(context.Background(), r, ""); !errors.Is(err, domain.ErrUnknownTextVersion) {
		t.Fatalf("err = %v", err)
	}
}

func TestTheSameIdempotencyKeyReturnsTheFirstConsent(t *testing.T) {
	s, st, rec, _ := setup(t)
	first, err := s.Create(context.Background(), request("u1"), "key-1")
	if err != nil {
		t.Fatal(err)
	}
	again, err := s.Create(context.Background(), request("u1"), "key-1")
	if err != nil || again.ID != first.ID || st.Len() != 1 || len(rec.types()) != 1 {
		t.Fatalf("again = %v, %v (%d rows, %d events)", again.ID, err, st.Len(), len(rec.types()))
	}
	other := request("u1")
	other.Provider = "billetera-demo"
	if _, err := s.Create(context.Background(), other, "key-1"); !errors.Is(err, domain.ErrIdempotencyConflict) {
		t.Fatalf("other request, same key: err = %v", err)
	}
	if _, err := s.Create(context.Background(), request("u2"), "key-1"); err != nil {
		t.Fatalf("another user may use the same key: %v", err)
	}
}

// HU-007: the user sees only their own consents, newest first, with the status as of now.
func TestListShowsOnlyTheUsersConsentsWithTheCurrentStatus(t *testing.T) {
	s, _, _, clk := setup(t)
	older := create(t, s, "u1")
	clk.Advance(time.Minute)
	newer := create(t, s, "u1")
	create(t, s, "u2")
	if err := s.MarkGranted(context.Background(), older.ID, "bd-1"); err != nil {
		t.Fatal(err)
	}
	clk.Advance(366 * 24 * time.Hour) // past the term, before the daily job runs

	list, err := s.List(context.Background(), "u1")
	if err != nil || len(list) != 2 {
		t.Fatalf("List = %d, %v", len(list), err)
	}
	if list[0].ID != newer.ID || list[1].ID != older.ID {
		t.Fatal("not newest first")
	}
	if list[1].Status != domain.StatusExpired || list[1].GrantedAt == nil || list[1].ExpiresAt == nil {
		t.Fatalf("older %+v", list[1])
	}
}

func TestGetHidesOtherUsersConsents(t *testing.T) {
	s, _, _, _ := setup(t)
	c := create(t, s, "u1")
	if _, err := s.Get(context.Background(), "u2", c.ID); !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
	if got, err := s.Get(context.Background(), "u1", c.ID); err != nil || got.ID != c.ID {
		t.Fatalf("Get = %+v, %v", got, err)
	}
}

func TestMarkGrantedActivatesForTwelveMonths(t *testing.T) {
	s, _, _, clk := setup(t)
	c := create(t, s, "u1")
	if ok, _ := s.Active(context.Background(), "u1", c.ID); ok {
		t.Fatal("a pending consent is not active")
	}
	clk.Advance(time.Minute)
	if err := s.MarkGranted(context.Background(), c.ID, "bd-1"); err != nil {
		t.Fatal(err)
	}
	got, _ := s.Get(context.Background(), "u1", c.ID)
	if got.Status != domain.StatusActive || !got.ExpiresAt.Equal(t0.Add(time.Minute).AddDate(0, 0, 365)) {
		t.Fatalf("granted %+v", got)
	}
	if ok, err := s.Active(context.Background(), "u1", c.ID); !ok || err != nil {
		t.Fatalf("Active = %v, %v", ok, err)
	}
	if err := s.MarkGranted(context.Background(), c.ID, "bd-1"); !errors.Is(err, domain.ErrNotPending) {
		t.Fatalf("second grant: err = %v", err)
	}
}

// Module test: a consent cannot become active without evidence and a known text version.
func TestMarkGrantedRefusesAConsentWithoutEvidenceOrKnownText(t *testing.T) {
	s, st, _, _ := setup(t)
	noEvidence := create(t, s, "u1")
	st.Edit(noEvidence.ID, func(c *domain.Consent) { c.Evidence = domain.Evidence{} })
	if err := s.MarkGranted(context.Background(), noEvidence.ID, "bd-1"); !errors.Is(err, domain.ErrMissingEvidence) {
		t.Errorf("without evidence: err = %v", err)
	}
	unknownText := create(t, s, "u1")
	st.Edit(unknownText.ID, func(c *domain.Consent) { c.TextVersion = "2099-01-v9" })
	if err := s.MarkGranted(context.Background(), unknownText.ID, "bd-1"); !errors.Is(err, domain.ErrUnknownTextVersion) {
		t.Errorf("unknown text: err = %v", err)
	}
	for _, id := range []string{noEvidence.ID, unknownText.ID} {
		if ok, _ := s.Active(context.Background(), "u1", id); ok {
			t.Errorf("%s became active", id)
		}
	}
}

func TestActiveIsFalseForAnotherUserOrAnUnknownConsent(t *testing.T) {
	s, _, _, _ := setup(t)
	c := create(t, s, "u1")
	_ = s.MarkGranted(context.Background(), c.ID, "bd-1")
	if ok, err := s.Active(context.Background(), "u2", c.ID); ok || err != nil {
		t.Fatalf("other user: %v, %v", ok, err)
	}
	if ok, err := s.Active(context.Background(), "u1", "0192f0a0-0000-7000-8000-00000000dead"); ok || err != nil {
		t.Fatalf("unknown: %v, %v", ok, err)
	}
}

// Module test: expiry after term_days with an injected clock, recorded once.
func TestExpireDueMarksExpiredConsentsOnce(t *testing.T) {
	s, st, rec, clk := setup(t)
	c := create(t, s, "u1")
	_ = s.MarkGranted(context.Background(), c.ID, "bd-1")
	clk.Advance(365*24*time.Hour - time.Second)
	if n, _ := s.ExpireDue(context.Background()); n != 0 {
		t.Fatalf("expired %d before the term", n)
	}
	if ok, _ := s.Active(context.Background(), "u1", c.ID); !ok {
		t.Fatal("still active one second before the term")
	}
	clk.Advance(time.Second)
	if ok, _ := s.Active(context.Background(), "u1", c.ID); ok {
		t.Fatal("Active must be false when the term ends, even before the job runs")
	}
	if n, err := s.ExpireDue(context.Background()); n != 1 || err != nil {
		t.Fatalf("ExpireDue = %d, %v", n, err)
	}
	if n, _ := s.ExpireDue(context.Background()); n != 0 {
		t.Fatal("a second run expires nothing")
	}
	stored, _ := st.Get(context.Background(), c.ID)
	if stored.Status != domain.StatusExpired {
		t.Fatalf("stored status %s", stored.Status)
	}
	want := []string{audit.ConsentCreated, audit.ConsentGranted, audit.ConsentExpired}
	if got := rec.types(); strings.Join(got, ",") != strings.Join(want, ",") {
		t.Fatalf("audit %v, want %v", got, want)
	}
}

func TestRunExpiryRunsAtOnceAndStopsWithTheContext(t *testing.T) {
	s, st, _, clk := setup(t)
	c := create(t, s, "u1")
	_ = s.MarkGranted(context.Background(), c.ID, "bd-1")
	clk.Advance(400 * 24 * time.Hour)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { s.RunExpiry(ctx, time.Hour); close(done) }()
	deadline := time.Now().Add(2 * time.Second)
	for {
		if got, _ := st.Get(context.Background(), c.ID); got.Status == domain.StatusExpired {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("the first run did not expire the consent")
		}
		time.Sleep(5 * time.Millisecond)
	}
	cancel()
	<-done
}

// Module test: one audit row per state change, none with amounts, emails or tokens.
func TestEveryStateChangeIsAuditedWithProviderAndConsentIDOnly(t *testing.T) {
	s, _, rec, _ := setup(t)
	c := create(t, s, "u1")
	_ = s.MarkGranted(context.Background(), c.ID, "bd-1")
	if len(rec.events) != 2 {
		t.Fatalf("%d events", len(rec.events))
	}
	for _, e := range rec.events {
		if e.UserID != "u1" || e.DeviceID != device || !e.At.Equal(t0) {
			t.Errorf("%s: %+v", e.Type, e)
		}
		if len(e.Meta) != 2 || e.Meta["provider"] != "banco-demo" || e.Meta["consent_id"] != c.ID {
			t.Errorf("%s: meta %v", e.Type, e.Meta)
		}
	}
}

func TestAnAuditFailureDoesNotUndoTheChange(t *testing.T) {
	s, _, rec, _ := setup(t)
	rec.err = errors.New("audit store down")
	c := create(t, s, "u1")
	if err := s.MarkGranted(context.Background(), c.ID, "bd-1"); err != nil {
		t.Fatalf("MarkGranted: %v", err)
	}
	if ok, _ := s.Active(context.Background(), "u1", c.ID); !ok {
		t.Fatal("the grant must stand")
	}
}
