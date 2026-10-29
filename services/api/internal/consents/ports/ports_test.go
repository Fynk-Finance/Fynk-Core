package ports

import (
	"context"
	"errors"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

func TestLocalCheckerIsAlwaysActiveInLocal(t *testing.T) {
	var c ConsentChecker = LocalChecker{Env: config.EnvLocal}
	ok, err := c.Active(context.Background(), "u1", "c1")
	if err != nil || !ok {
		t.Fatalf("Active = %v, %v", ok, err)
	}
	if err := c.MarkGranted(context.Background(), "c1", "p1"); err != nil {
		t.Fatalf("MarkGranted: %v", err)
	}
}

func TestLocalCheckerFailsClosedOutsideLocal(t *testing.T) {
	for _, env := range []config.Env{config.EnvStaging, config.EnvProd} {
		c := LocalChecker{Env: env}
		ok, err := c.Active(context.Background(), "u1", "c1")
		if ok || !errors.Is(err, ErrNotImplemented) {
			t.Fatalf("%s: Active = %v, %v", env, ok, err)
		}
		if err := c.MarkGranted(context.Background(), "c1", "p1"); !errors.Is(err, ErrNotImplemented) {
			t.Fatalf("%s: MarkGranted err = %v", env, err)
		}
	}
}

type fakeGetter struct {
	c   domain.Consent
	err error
}

func (f fakeGetter) Get(context.Context, string, string) (domain.Consent, error) { return f.c, f.err }

func TestPendingReaderGivesTheUsersPendingConsentWithWhatTheyAccepted(t *testing.T) {
	r := pendingReader{svc: fakeGetter{c: domain.Consent{
		ID: "c-1", Provider: "banco-demo", Status: domain.StatusPending,
		Scopes:  []domain.Scope{"balances", "transactions"},
		Purpose: domain.Purpose, TermDays: domain.TermDays,
	}}}
	p, err := r.Pending(context.Background(), "u1", "c-1")
	if err != nil {
		t.Fatal(err)
	}
	if p.ID != "c-1" || p.Provider != "banco-demo" || len(p.Scopes) != 2 || p.Scopes[1] != "transactions" ||
		p.Purpose != domain.Purpose || p.TermDays != 365 {
		t.Fatalf("got %+v", p)
	}
}

func TestPendingReaderRefusesAConsentThatIsNotPending(t *testing.T) {
	for _, st := range []domain.Status{domain.StatusActive, domain.StatusRevoked, domain.StatusExpired, domain.StatusFailed} {
		r := pendingReader{svc: fakeGetter{c: domain.Consent{ID: "c-1", Status: st}}}
		if _, err := r.Pending(context.Background(), "u1", "c-1"); !errors.Is(err, ErrConsentNotPending) {
			t.Fatalf("%s: got %v, want ErrConsentNotPending", st, err)
		}
	}
}

func TestPendingReaderPassesNotFoundForAnotherUsersConsent(t *testing.T) {
	r := pendingReader{svc: fakeGetter{err: domain.ErrNotFound}}
	if _, err := r.Pending(context.Background(), "u2", "c-1"); !errors.Is(err, ErrConsentNotFound) {
		t.Fatalf("got %v, want ErrConsentNotFound", err)
	}
}
