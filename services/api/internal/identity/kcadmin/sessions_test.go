package kcadmin

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

// sessionsServer answers the token request and GET /users/u1/sessions with code and body.
func sessionsServer(t *testing.T, code int, body string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.URL.Path == "/realms/fynk/protocol/openid-connect/token":
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "tok", "expires_in": 300})
		case r.Method == http.MethodGet && r.URL.Path == "/admin/realms/fynk/users/u1/sessions" && r.Header.Get("Authorization") == "Bearer tok":
			w.WriteHeader(code)
			_, _ = w.Write([]byte(body))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(srv.Close)
	return New(config.Config{KeycloakURL: srv.URL, KeycloakRealm: "fynk", KeycloakAdminClientSecret: secret}, srv.Client())
}

func TestSessionStart(t *testing.T) {
	list := `[{"id":"s1","start":1793534400123},{"id":"s2","start":1793534500000},{"id":"s3","start":0}]`
	cases := []struct {
		name string
		body string
		sid  string
		want time.Time
		ok   bool
	}{
		{"first", list, "s1", time.UnixMilli(1793534400123).UTC(), true},
		{"second", list, "s2", time.UnixMilli(1793534500000).UTC(), true},
		{"unknown", list, "s9", time.Time{}, false},
		{"no start", list, "s3", time.Time{}, false},
		{"empty list", `[]`, "s1", time.Time{}, false},
		{"empty sid", list, "", time.Time{}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := sessionsServer(t, http.StatusOK, tc.body)
			at, ok, err := c.SessionStart(context.Background(), "u1", tc.sid)
			if err != nil || ok != tc.ok || !at.Equal(tc.want) {
				t.Fatalf("got %v %v %v, want %v %v", at, ok, err, tc.want, tc.ok)
			}
		})
	}
}

func TestSessionStartErrors(t *testing.T) {
	c := sessionsServer(t, http.StatusNotFound, "")
	if _, _, err := c.SessionStart(context.Background(), "u1", "s1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("404: %v", err)
	}
	c = sessionsServer(t, http.StatusInternalServerError, "u1 secret-detail s1")
	_, _, err := c.SessionStart(context.Background(), "u1", "s1")
	if err == nil || errors.Is(err, ErrNotFound) || strings.Contains(err.Error(), "u1") || strings.Contains(err.Error(), "s1") || strings.Contains(err.Error(), "secret-detail") {
		t.Fatalf("500: %v", err)
	}
	c = sessionsServer(t, http.StatusOK, "not json")
	if _, _, err := c.SessionStart(context.Background(), "u1", "s1"); err == nil || strings.Contains(err.Error(), "not json") {
		t.Fatalf("bad json: %v", err)
	}
	if _, _, err := New(config.Config{}, nil).SessionStart(context.Background(), "u1", "s1"); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("unconfigured: %v", err)
	}
}
