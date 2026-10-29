package ports

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/token"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

// The checker builds without touching the pool, so a nil pool must not panic.
func TestNewDeviceCheckerBuildsWithoutPool(t *testing.T) {
	if !isChecker(NewDeviceChecker(nil, clock.System{})) {
		t.Fatal("NewDeviceChecker returned nil")
	}
}

func isChecker(c token.DeviceChecker) bool { return c != nil }

func TestEmailResetsMapsAMissingUserToErrNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/realms/fynk/protocol/openid-connect/token" {
			_, _ = w.Write([]byte(`{"access_token":"tok","expires_in":300}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)
	r := NewEmailResets(config.Config{KeycloakURL: srv.URL, KeycloakRealm: "fynk", KeycloakAdminClientSecret: "s"})
	if _, _, err := r.EmailResetAt(context.Background(), "nobody"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestSessionsMapsAMissingUserToErrNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/realms/fynk/protocol/openid-connect/token" {
			_, _ = w.Write([]byte(`{"access_token":"tok","expires_in":300}`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	t.Cleanup(srv.Close)
	s := NewSessions(config.Config{KeycloakURL: srv.URL, KeycloakRealm: "fynk", KeycloakAdminClientSecret: "s"})
	if _, _, err := s.SessionStart(context.Background(), "nobody", "sid"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("err = %v, want ErrNotFound", err)
	}
}

func TestSessionsReturnsTheStartOfTheSession(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/realms/fynk/protocol/openid-connect/token" {
			_, _ = w.Write([]byte(`{"access_token":"tok","expires_in":300}`))
			return
		}
		_, _ = w.Write([]byte(`[{"id":"sid","start":1793534400000}]`))
	}))
	t.Cleanup(srv.Close)
	s := NewSessions(config.Config{KeycloakURL: srv.URL, KeycloakRealm: "fynk", KeycloakAdminClientSecret: "s"})
	at, ok, err := s.SessionStart(context.Background(), "u1", "sid")
	if err != nil || !ok || at.UnixMilli() != 1793534400000 {
		t.Fatalf("got %v %v %v", at, ok, err)
	}
	if _, ok, _ := s.SessionStart(context.Background(), "u1", "other"); ok {
		t.Fatal("unknown sid found")
	}
}
