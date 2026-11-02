package kcadmin

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

const secret = "unit-test-secret"

type fakeKC struct {
	mu         sync.Mutex
	tokens     atomic.Int32
	expiresIn  int
	userBody   string
	userCode   int
	okBody     string // replaces the default user answer when set
	eventsBody string // replaces the default events answer when set
	puts       []map[string]any
	deletes    []string
	lastForm   string
	lastQuery  string
}

func (f *fakeKC) handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		switch {
		case r.URL.Path == "/realms/fynk/protocol/openid-connect/token":
			f.tokens.Add(1)
			raw, _ := io.ReadAll(r.Body)
			f.lastForm, f.lastQuery = string(raw), r.URL.RawQuery
			time.Sleep(20 * time.Millisecond)
			_ = json.NewEncoder(w).Encode(map[string]any{"access_token": "tok", "expires_in": f.expiresIn})
		case r.Header.Get("Authorization") != "Bearer tok":
			w.WriteHeader(http.StatusUnauthorized)
		case r.Method == http.MethodGet && r.URL.Path == "/admin/realms/fynk/users/u1":
			if f.userCode != 0 {
				w.WriteHeader(f.userCode)
				_, _ = w.Write([]byte(f.userBody))
				return
			}
			if f.okBody != "" {
				_, _ = w.Write([]byte(f.okBody))
				return
			}
			_, _ = w.Write([]byte(`{"id":"u1","email":"camila@correo.com","firstName":"Camila","lastName":"Rojas","emailVerified":true,"createdTimestamp":1793109791000,"attributes":{"terms_and_conditions":["1"]},"enabled":true}`))
		case r.Method == http.MethodPut && r.URL.Path == "/admin/realms/fynk/users/u1":
			var m map[string]any
			_ = json.NewDecoder(r.Body).Decode(&m)
			f.puts = append(f.puts, m)
			w.WriteHeader(http.StatusNoContent)
		case r.URL.Path == "/admin/realms/fynk/users/u1/credentials":
			_, _ = w.Write([]byte(`[{"type":"otp","createdDate":5},{"type":"password","createdDate":1793109800000}]`))
		case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.EscapedPath(), "/admin/realms/fynk/sessions/"):
			f.deletes = append(f.deletes, r.URL.EscapedPath())
			if strings.HasSuffix(r.URL.Path, "gone") {
				w.WriteHeader(http.StatusNotFound)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		case r.Method == http.MethodGet && r.URL.Path == "/admin/realms/fynk/events":
			f.lastQuery = r.URL.RawQuery
			if f.userCode != 0 {
				w.WriteHeader(f.userCode)
				return
			}
			if f.eventsBody != "" {
				_, _ = w.Write([]byte(f.eventsBody))
				return
			}
			_, _ = w.Write([]byte(`[{"id":"e1","time":1793109791000,"type":"LOGIN","userId":"u1","ipAddress":"10.0.0.1"}]`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	})
}

func setup(t *testing.T, f *fakeKC) *Client {
	t.Helper()
	srv := httptest.NewServer(f.handler())
	t.Cleanup(srv.Close)
	return New(config.Config{KeycloakURL: srv.URL, KeycloakRealm: "fynk", KeycloakAdminClientSecret: secret}, srv.Client())
}

func TestTokenIsFormEncodedAndCached(t *testing.T) {
	f := &fakeKC{expiresIn: 300}
	c := setup(t, f)
	for range 3 {
		if _, err := c.GetUser(context.Background(), "u1"); err != nil {
			t.Fatal(err)
		}
	}
	if f.tokens.Load() != 1 {
		t.Fatalf("token requests = %d, want 1", f.tokens.Load())
	}
	if f.lastQuery != "" || !strings.Contains(f.lastForm, "client_id=fynk-admin") ||
		!strings.Contains(f.lastForm, "grant_type=client_credentials") || !strings.Contains(f.lastForm, "client_secret="+secret) {
		t.Fatalf("token request form %q query %q", f.lastForm, f.lastQuery)
	}
}

func TestTokenRefreshesBeforeExpiry(t *testing.T) {
	f := &fakeKC{expiresIn: 300}
	c := setup(t, f)
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	c.now = func() time.Time { return now }
	_, _ = c.GetUser(context.Background(), "u1")
	now = now.Add(269 * time.Second)
	_, _ = c.GetUser(context.Background(), "u1")
	if f.tokens.Load() != 1 {
		t.Fatalf("token requests = %d before the 30 s margin", f.tokens.Load())
	}
	now = now.Add(2 * time.Second)
	_, _ = c.GetUser(context.Background(), "u1")
	if f.tokens.Load() != 2 {
		t.Fatalf("token requests = %d after the margin, want 2", f.tokens.Load())
	}
}

func TestConcurrentCallersMakeOneTokenRequest(t *testing.T) {
	f := &fakeKC{expiresIn: 300}
	c := setup(t, f)
	var wg sync.WaitGroup
	for range 10 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := c.GetUser(context.Background(), "u1"); err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
	if f.tokens.Load() != 1 {
		t.Fatalf("token requests = %d, want 1", f.tokens.Load())
	}
}

func TestGetUserAndPasswordDate(t *testing.T) {
	c := setup(t, &fakeKC{expiresIn: 300})
	u, err := c.GetUser(context.Background(), "u1")
	if err != nil {
		t.Fatal(err)
	}
	want := time.UnixMilli(1793109791000).UTC()
	if u.Email != "camila@correo.com" || u.FirstName != "Camila" || u.LastName != "Rojas" || !u.EmailVerified || !u.CreatedAt.Equal(want) {
		t.Fatalf("user %+v", u)
	}
	at, ok, err := c.PasswordUpdatedAt(context.Background(), "u1")
	if err != nil || !ok || !at.Equal(time.UnixMilli(1793109800000)) {
		t.Fatalf("password date %v %v %v", at, ok, err)
	}
}

func TestUpdateNamesKeepsTheRestAndDropsAttributes(t *testing.T) {
	f := &fakeKC{expiresIn: 300}
	c := setup(t, f)
	if err := c.UpdateNames(context.Background(), "u1", "Ana", "Pérez"); err != nil {
		t.Fatal(err)
	}
	if len(f.puts) != 1 {
		t.Fatalf("puts = %d", len(f.puts))
	}
	p := f.puts[0]
	if p["firstName"] != "Ana" || p["lastName"] != "Pérez" || p["email"] != "camila@correo.com" ||
		p["emailVerified"] != true || p["enabled"] != true {
		t.Fatalf("put body %v", p)
	}
	if _, has := p["attributes"]; has {
		t.Fatal("attributes must not be sent back")
	}
}

func TestNotFoundAndErrorsWithoutBodies(t *testing.T) {
	f := &fakeKC{expiresIn: 300, userCode: http.StatusNotFound}
	c := setup(t, f)
	if _, err := c.GetUser(context.Background(), "u1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("404: %v", err)
	}
	if err := c.UpdateNames(context.Background(), "u1", "A", "B"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("404 on update: %v", err)
	}
	f.mu.Lock()
	f.userCode, f.userBody = http.StatusInternalServerError, "camila@correo.com secret-detail"
	f.mu.Unlock()
	_, err := c.GetUser(context.Background(), "u1")
	if err == nil || errors.Is(err, ErrNotFound) {
		t.Fatalf("500: %v", err)
	}
	for _, leak := range []string{"camila", "secret-detail", secret} {
		if strings.Contains(err.Error(), leak) {
			t.Fatalf("error leaks %q: %v", leak, err)
		}
	}
	if !strings.Contains(err.Error(), "500") {
		t.Fatalf("error lacks the status: %v", err)
	}
}

func TestDeleteSession(t *testing.T) {
	f := &fakeKC{expiresIn: 300}
	c := setup(t, f)
	if err := c.DeleteSession(context.Background(), "s/1 x"); err != nil {
		t.Fatal(err)
	}
	if f.deletes[0] != "/admin/realms/fynk/sessions/s%2F1%20x" {
		t.Fatalf("path %q", f.deletes[0])
	}
	if err := c.DeleteSession(context.Background(), "gone"); err != nil {
		t.Fatalf("404 must be nil, got %v", err)
	}
}

func TestUnavailableWithoutSecretOrServer(t *testing.T) {
	hit := false
	srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { hit = true }))
	defer srv.Close()
	c := New(config.Config{KeycloakURL: srv.URL, KeycloakRealm: "fynk"}, srv.Client())
	if _, err := c.GetUser(context.Background(), "u1"); !errors.Is(err, ErrUnavailable) {
		t.Fatal(err)
	}
	if _, _, err := c.PasswordUpdatedAt(context.Background(), "u1"); !errors.Is(err, ErrUnavailable) {
		t.Fatal(err)
	}
	if err := c.UpdateNames(context.Background(), "u1", "A", "B"); !errors.Is(err, ErrUnavailable) {
		t.Fatal(err)
	}
	if err := c.DeleteSession(context.Background(), "s"); !errors.Is(err, ErrUnavailable) {
		t.Fatal(err)
	}
	if hit {
		t.Fatal("no network call expected without a secret")
	}
	down := New(config.Config{KeycloakURL: "http://127.0.0.1:1", KeycloakRealm: "fynk", KeycloakAdminClientSecret: secret}, nil)
	if _, err := down.GetUser(context.Background(), "u1"); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("unreachable: %v", err)
	}
}

func TestEmailResetAt(t *testing.T) {
	cases := []struct {
		name string
		body string
		want time.Time
		ok   bool
	}{
		{"set", `{"attributes":{"fynkEmailResetAt":["1793534400123"]}}`, time.UnixMilli(1793534400123).UTC(), true},
		{"other attributes only", `{"attributes":{"terms_and_conditions":["1"]}}`, time.Time{}, false},
		{"no attributes", `{"id":"u1"}`, time.Time{}, false},
		{"empty list", `{"attributes":{"fynkEmailResetAt":[]}}`, time.Time{}, false},
		{"not a number", `{"attributes":{"fynkEmailResetAt":["yesterday"]}}`, time.Time{}, false},
		{"zero", `{"attributes":{"fynkEmailResetAt":["0"]}}`, time.Time{}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := setup(t, &fakeKC{expiresIn: 300, okBody: tc.body})
			at, ok, err := c.EmailResetAt(context.Background(), "u1")
			if err != nil || ok != tc.ok || !at.Equal(tc.want) {
				t.Fatalf("got %v %v %v, want %v %v", at, ok, err, tc.want, tc.ok)
			}
		})
	}
}

func TestEmailResetAtErrors(t *testing.T) {
	f := &fakeKC{expiresIn: 300, userCode: http.StatusNotFound}
	c := setup(t, f)
	if _, _, err := c.EmailResetAt(context.Background(), "u1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("404: %v", err)
	}
	f.mu.Lock()
	f.userCode, f.userBody = http.StatusInternalServerError, "u1 secret-detail"
	f.mu.Unlock()
	_, _, err := c.EmailResetAt(context.Background(), "u1")
	if err == nil || errors.Is(err, ErrNotFound) || strings.Contains(err.Error(), "u1") || strings.Contains(err.Error(), "secret-detail") {
		t.Fatalf("500: %v", err)
	}
	if _, _, err := New(config.Config{}, nil).EmailResetAt(context.Background(), "u1"); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("unconfigured: %v", err)
	}
}

func TestGetEvents(t *testing.T) {
	f := &fakeKC{expiresIn: 300}
	c := setup(t, f)
	evts, err := c.GetEvents(context.Background(), EventsFilter{
		DateFrom: "2026-10-28",
		Types:    []string{"LOGIN", "LOGIN_ERROR"},
		Client:   "fynk-mobile",
		First:    0,
		Max:      50,
	})
	if err != nil {
		t.Fatalf("GetEvents: %v", err)
	}
	if len(evts) != 1 || evts[0].ID != "e1" || evts[0].Type != "LOGIN" || evts[0].UserID != "u1" {
		t.Fatalf("unexpected events: %+v", evts)
	}
	if !strings.Contains(f.lastQuery, "dateFrom=2026-10-28") || !strings.Contains(f.lastQuery, "type=LOGIN") ||
		!strings.Contains(f.lastQuery, "client=fynk-mobile") || !strings.Contains(f.lastQuery, "max=50") {
		t.Fatalf("unexpected query string: %s", f.lastQuery)
	}

	// Unconfigured client returns ErrUnavailable
	if _, err := New(config.Config{}, nil).GetEvents(context.Background(), EventsFilter{}); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("expected ErrUnavailable, got: %v", err)
	}
}
