package consents

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/service"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/store"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

const device = "0192f0a0-0000-7000-8000-000000000001"

var (
	body = "# Autorización para compartir tus datos con Fynk\n"
	sum  = sha256.Sum256([]byte(body))
	t0   = time.Date(2026, 10, 27, 15, 0, 0, 0, time.UTC)
)

// tokens maps each test token to its user, like M1's verifier does with Keycloak tokens.
type tokens map[string]string

func (t tokens) Verify(_ context.Context, token, deviceID string) (auth.User, error) {
	id, ok := t[token]
	if !ok {
		return auth.User{}, auth.ErrInvalidToken
	}
	return auth.User{ID: id, EmailVerified: true, DeviceID: deviceID}, nil
}

type nopRecorder struct{}

func (nopRecorder) Record(context.Context, audit.Event) error { return nil }

func newAPI(t *testing.T) *httptest.Server {
	t.Helper()
	auth.Install(tokens{"token-ana": "ana", "token-beto": "beto"})
	t.Cleanup(func() { auth.Install(nil) })
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	st := store.NewMemory(domain.Text{Version: "2026-10-v1", BodyMD: body, SHA256: sum[:], PublishedAt: t0})
	m := consentsModule{svc: service.New(st, clock.NewFixed(t0), nopRecorder{}, log)}
	r := chi.NewRouter()
	r.Route("/v1", m.Routes)
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

// reply is what a test reads from a response, whose body call already closed.
type reply struct {
	StatusCode int
	Header     http.Header
}

func call(t *testing.T, method, url, token string, payload any) (reply, []byte) {
	t.Helper()
	var reqBody io.Reader
	if payload != nil {
		b, _ := json.Marshal(payload)
		reqBody = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, url, reqBody)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set(auth.DeviceHeader, device)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	out, _ := io.ReadAll(res.Body)
	_ = res.Body.Close()
	return reply{res.StatusCode, res.Header}, out
}

func validRequest() map[string]any {
	return map[string]any{
		"provider":    "banco-demo",
		"scopes":      []string{"balances", "transactions", "account_details"},
		"purpose":     domain.Purpose,
		"termDays":    365,
		"textVersion": "2026-10-v1",
		"textSha256":  hex.EncodeToString(sum[:]),
		"appVersion":  "0.1.0",
		"locale":      "es-CO",
	}
}

func problemCode(t *testing.T, b []byte) string {
	t.Helper()
	var p problem.Problem
	if err := json.Unmarshal(b, &p); err != nil {
		t.Fatalf("not problem JSON: %s", b)
	}
	return p.Code
}

func TestEveryRouteNeedsATokenBeforeTheRequestIsParsed(t *testing.T) {
	srv := newAPI(t)
	for _, tc := range []struct{ method, path string }{
		{http.MethodGet, "/v1/consent-texts/current"},
		{http.MethodGet, "/v1/consents"},
		{http.MethodPost, "/v1/consents"},
		{http.MethodGet, "/v1/consents/not-a-uuid"},
	} {
		res, b := call(t, tc.method, srv.URL+tc.path, "", nil)
		if res.StatusCode != http.StatusUnauthorized || problemCode(t, b) != "unauthorized" {
			t.Errorf("%s %s: %d %s", tc.method, tc.path, res.StatusCode, b)
		}
	}
	if res, _ := call(t, http.MethodGet, srv.URL+"/v1/consents/health", "", nil); res.StatusCode != http.StatusOK {
		t.Errorf("health: %d, want 200 without a token", res.StatusCode)
	}
}

// HU-006: the app gets the scope text, the purpose and the term to show.
func TestCurrentTextShowsPurposeAndTerm(t *testing.T) {
	srv := newAPI(t)
	res, b := call(t, http.MethodGet, srv.URL+"/v1/consent-texts/current", "token-ana", nil)
	var got map[string]any
	_ = json.Unmarshal(b, &got)
	if res.StatusCode != http.StatusOK || got["version"] != "2026-10-v1" || got["sha256"] != hex.EncodeToString(sum[:]) ||
		got["purpose"] != domain.Purpose || got["termDays"] != float64(365) {
		t.Fatalf("%d %s", res.StatusCode, b)
	}
}

// HU-006 and HU-007: the accepted consent is recorded and then shown with its status and dates.
func TestCreateThenReadTheConsent(t *testing.T) {
	srv := newAPI(t)
	res, b := call(t, http.MethodPost, srv.URL+"/v1/consents", "token-ana", validRequest())
	var created map[string]any
	_ = json.Unmarshal(b, &created)
	if res.StatusCode != http.StatusCreated || created["status"] != "pending" || created["acceptedAt"] != "2026-10-27T15:00:00Z" {
		t.Fatalf("create: %d %s", res.StatusCode, b)
	}
	id := created["id"].(string)

	res, b = call(t, http.MethodGet, srv.URL+"/v1/consents/"+id, "token-ana", nil)
	if res.StatusCode != http.StatusOK || !bytes.Contains(b, []byte(`"termDays":365`)) {
		t.Fatalf("get: %d %s", res.StatusCode, b)
	}
	res, b = call(t, http.MethodGet, srv.URL+"/v1/consents", "token-ana", nil)
	var list struct{ Items []map[string]any }
	_ = json.Unmarshal(b, &list)
	if res.StatusCode != http.StatusOK || len(list.Items) != 1 || list.Items[0]["id"] != id {
		t.Fatalf("list: %d %s", res.StatusCode, b)
	}
}

func TestAnotherUserNeitherSeesNorListsTheConsent(t *testing.T) {
	srv := newAPI(t)
	_, b := call(t, http.MethodPost, srv.URL+"/v1/consents", "token-ana", validRequest())
	var created map[string]any
	_ = json.Unmarshal(b, &created)
	res, b := call(t, http.MethodGet, srv.URL+"/v1/consents/"+created["id"].(string), "token-beto", nil)
	if res.StatusCode != http.StatusNotFound || problemCode(t, b) != "consent_not_found" {
		t.Fatalf("get: %d %s", res.StatusCode, b)
	}
	if _, b := call(t, http.MethodGet, srv.URL+"/v1/consents", "token-beto", nil); !bytes.Equal(bytes.TrimSpace(b), []byte(`{"items":[]}`)) {
		t.Fatalf("list: %s", b)
	}
}

func TestABrokenRuleAnswers422WithItsCode(t *testing.T) {
	srv := newAPI(t)
	req := validRequest()
	req["purpose"] = "Cualquier uso."
	res, b := call(t, http.MethodPost, srv.URL+"/v1/consents", "token-ana", req)
	if res.StatusCode != http.StatusUnprocessableEntity || problemCode(t, b) != "purpose_mismatch" {
		t.Fatalf("%d %s", res.StatusCode, b)
	}
	if res.Header.Get("Content-Type") != problem.ContentType {
		t.Fatalf("Content-Type %q", res.Header.Get("Content-Type"))
	}
}

func TestTheSameIdempotencyKeyCreatesOneConsent(t *testing.T) {
	srv := newAPI(t)
	ids := map[string]bool{}
	for i := 0; i < 2; i++ {
		b, _ := json.Marshal(validRequest())
		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/v1/consents", bytes.NewReader(b))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer token-ana")
		req.Header.Set(auth.DeviceHeader, device)
		req.Header.Set("Idempotency-Key", "k-1")
		res, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		var c map[string]any
		_ = json.NewDecoder(res.Body).Decode(&c)
		_ = res.Body.Close()
		ids[c["id"].(string)] = true
	}
	if len(ids) != 1 {
		t.Fatalf("got %d consents", len(ids))
	}
}
