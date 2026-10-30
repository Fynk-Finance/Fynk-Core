package store

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/link"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// testAuthorizations runs the same rules against every Authorizations store.
func testAuthorizations(t *testing.T, s Authorizations, id string, expire func()) {
	ctx := context.Background()
	a := link.Authorization{ID: id, UserID: "user-a", DeviceID: "device-a", ConsentID: "c-1",
		Provider: "banco-demo", RedirectURI: "fynk://bank/callback", ExpiresAt: at.Add(10 * time.Minute)}

	if err := s.Save(ctx, a, time.Minute); err != nil {
		t.Fatal(err)
	}
	if err := s.Save(ctx, a, time.Minute); err == nil {
		t.Fatal("saving the same id twice must fail")
	}
	got, err := s.Take(ctx, id)
	if err != nil {
		t.Fatal(err)
	}
	if got.UserID != "user-a" || got.ConsentID != "c-1" || got.RedirectURI != "fynk://bank/callback" ||
		!got.ExpiresAt.Equal(a.ExpiresAt) {
		t.Fatalf("got %+v", got)
	}
	if _, err := s.Take(ctx, id); !errors.Is(err, link.ErrAuthorizationNotFound) {
		t.Fatalf("second take: got %v, want ErrAuthorizationNotFound", err)
	}

	a.ID = id + "-expiring"
	if err := s.Save(ctx, a, time.Second); err != nil {
		t.Fatal(err)
	}
	expire()
	if _, err := s.Take(ctx, a.ID); !errors.Is(err, link.ErrAuthorizationNotFound) {
		t.Fatalf("expired take: got %v, want ErrAuthorizationNotFound", err)
	}
}

func TestMemoryAuthorizations(t *testing.T) {
	c := clock.NewFixed(at)
	testAuthorizations(t, NewMemoryAuthorizations(c), "authz-1", func() { c.Advance(2 * time.Second) })
}
