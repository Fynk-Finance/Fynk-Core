package store

import (
	"context"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

type limits interface {
	Nonces
	Limiter
}

// testLimits runs the same rules against every store; wait lets the window and the nonce pass.
func testLimits(t *testing.T, s limits, user string, wait func(time.Duration)) {
	ctx := context.Background()

	ok, err := s.FirstUse(ctx, user, "nonce-1", time.Second)
	if err != nil || !ok {
		t.Fatalf("first use: %v %v", ok, err)
	}
	if ok, _ := s.FirstUse(ctx, user, "nonce-1", time.Second); ok {
		t.Fatal("a replayed nonce must be refused")
	}
	if ok, _ := s.FirstUse(ctx, user+"-other", "nonce-1", time.Second); !ok {
		t.Fatal("another user's nonce is another nonce")
	}

	for i := range 3 {
		if ok, _, err := s.Allow(ctx, user, 3, 2*time.Second); err != nil || !ok {
			t.Fatalf("query %d: %v %v", i+1, ok, err)
		}
	}
	ok, retry, err := s.Allow(ctx, user, 3, 2*time.Second)
	if err != nil || ok {
		t.Fatalf("the 4th query must be refused: %v %v", ok, err)
	}
	if retry <= 0 || retry > 2*time.Second {
		t.Fatalf("Retry-After = %v, want within the window", retry)
	}
	if ok, _, _ := s.Allow(ctx, user+"-other", 3, 2*time.Second); !ok {
		t.Fatal("the limit is per user")
	}

	wait(2100 * time.Millisecond)
	if ok, _ := s.FirstUse(ctx, user, "nonce-1", time.Second); !ok {
		t.Fatal("a nonce is forgotten after its TTL")
	}
	if ok, _, _ := s.Allow(ctx, user, 3, 2*time.Second); !ok {
		t.Fatal("a new window starts after the old one ends")
	}
}

func TestMemoryLimits(t *testing.T) {
	c := clock.NewFixed(at)
	testLimits(t, NewMemoryLimits(c), "user-a", c.Advance)
}
