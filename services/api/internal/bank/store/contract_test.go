package store

import (
	"bytes"
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/link"
)

var at = time.Date(2026, 10, 29, 15, 0, 0, 0, time.UTC)

func fp(b byte) []byte { return bytes.Repeat([]byte{b}, 32) }

func newLink(id, consentID string) link.Link {
	return link.Link{
		ID: id, UserID: "user-a", DeviceID: "0b4f5d1e-9a3c-4c2e-8f1a-2d3e4f5a6b7c", Provider: "banco-demo",
		ConsentID: consentID, TokenFingerprint: fp(1), Status: link.StatusActive, CreatedAt: at,
	}
}

// testStore runs the same rules against every link.Store.
func testStore(t *testing.T, s link.Store, id func(n int) string) {
	ctx := context.Background()

	t.Run("insert then get", func(t *testing.T) {
		l := newLink(id(1), id(101))
		if err := s.Insert(ctx, l); err != nil {
			t.Fatal(err)
		}
		got, err := s.Get(ctx, l.ID)
		if err != nil {
			t.Fatal(err)
		}
		if got.UserID != "user-a" || got.ConsentID != l.ConsentID || got.Status != link.StatusActive ||
			!bytes.Equal(got.TokenFingerprint, fp(1)) || !got.CreatedAt.Equal(at) {
			t.Fatalf("got %+v", got)
		}
	})

	t.Run("one link per consent", func(t *testing.T) {
		if err := s.Insert(ctx, newLink(id(2), id(101))); !errors.Is(err, link.ErrConsentLinked) {
			t.Fatalf("got %v, want ErrConsentLinked", err)
		}
	})

	t.Run("unknown link", func(t *testing.T) {
		if _, err := s.Get(ctx, id(99)); !errors.Is(err, link.ErrNotFound) {
			t.Fatalf("got %v, want ErrNotFound", err)
		}
	})

	t.Run("rotate needs the current fingerprint", func(t *testing.T) {
		l := newLink(id(3), id(103))
		_ = s.Insert(ctx, l)
		if err := s.Rotate(ctx, l.ID, fp(9), fp(2), at); !errors.Is(err, link.ErrStale) {
			t.Fatalf("wrong old fingerprint: got %v, want ErrStale", err)
		}
		if err := s.Rotate(ctx, l.ID, fp(1), fp(2), at.Add(time.Minute)); err != nil {
			t.Fatal(err)
		}
		got, _ := s.Get(ctx, l.ID)
		if !bytes.Equal(got.TokenFingerprint, fp(2)) || got.LastRefreshedAt == nil {
			t.Fatalf("not rotated: %+v", got)
		}
		if err := s.Rotate(ctx, l.ID, fp(1), fp(3), at); !errors.Is(err, link.ErrStale) {
			t.Fatalf("an old token after rotation: got %v, want ErrStale", err)
		}
	})

	t.Run("only one of two concurrent refreshes wins", func(t *testing.T) {
		l := newLink(id(4), id(104))
		_ = s.Insert(ctx, l)
		var wg sync.WaitGroup
		results := make(chan error, 2)
		for i := range 2 {
			wg.Add(1)
			go func() {
				defer wg.Done()
				results <- s.Rotate(ctx, l.ID, fp(1), fp(byte(10+i)), at)
			}()
		}
		wg.Wait()
		close(results)
		wins := 0
		for err := range results {
			if err == nil {
				wins++
			} else if !errors.Is(err, link.ErrStale) {
				t.Fatal(err)
			}
		}
		if wins != 1 {
			t.Fatalf("%d refreshes won, want 1", wins)
		}
	})

	t.Run("revoke ends the link, keeps the first date and stops rotations", func(t *testing.T) {
		l := newLink(id(5), id(105))
		_ = s.Insert(ctx, l)
		if err := s.Revoke(ctx, l.ID, at); err != nil {
			t.Fatal(err)
		}
		if err := s.Revoke(ctx, l.ID, at.Add(time.Hour)); err != nil {
			t.Fatal(err)
		}
		got, _ := s.Get(ctx, l.ID)
		if got.Status != link.StatusRevoked || got.RevokedAt == nil || !got.RevokedAt.Equal(at) {
			t.Fatalf("got %+v", got)
		}
		if err := s.Rotate(ctx, l.ID, fp(1), fp(2), at); !errors.Is(err, link.ErrStale) {
			t.Fatalf("rotate after revoke: got %v, want ErrStale", err)
		}
	})
}
