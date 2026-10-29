package app

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

type pinger struct{ err error }

func (p pinger) Ping(context.Context) error { return p.err }

var quiet = slog.New(slog.NewJSONHandler(io.Discard, nil))

func newServer(t *testing.T, checks map[string]Pinger) *httptest.Server {
	t.Helper()
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	h, err := NewRouter(quiet, All(Deps{}), checks)
	if err != nil {
		t.Fatalf("NewRouter: %v", err)
	}
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return srv
}

type reply struct {
	status int
	header http.Header
}

func get(t *testing.T, url, token string) (reply, []byte) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	body, _ := io.ReadAll(res.Body)
	if err := res.Body.Close(); err != nil {
		t.Fatalf("close body: %v", err)
	}
	return reply{res.StatusCode, res.Header}, body
}

func TestAllListsTheEightModulesOnce(t *testing.T) {
	want := []string{"identity", "backup", "consents", "bank", "catalog", "recommendations", "privacy", "market"}
	mods := All(Deps{})
	if len(mods) != len(want) {
		t.Fatalf("got %d modules, want %d", len(mods), len(want))
	}
	for i, m := range mods {
		if m.Name() != want[i] {
			t.Errorf("module %d = %q, want %q", i, m.Name(), want[i])
		}
		if m.Migrations() == nil {
			t.Errorf("%s: Migrations() is nil", m.Name())
		}
	}
}

func TestEveryStubRouteAnswers501ProblemJSON(t *testing.T) {
	srv := newServer(t, nil)
	// One path per endpoint group of the shared contracts, section 5, of the modules still stubbed.
	// M5 bank and M11 recommendations have real endpoints, tested in their own packages.
	paths := []string{
		"/v1/backup/unknown",
		"/v1/catalog/merchants", "/v1/privacy/policy", "/v1/market/cdt-products",
	}
	for _, p := range paths {
		res, body := get(t, srv.URL+p, auth.DevToken)
		if res.status != http.StatusNotImplemented {
			t.Errorf("%s: status %d, want 501", p, res.status)
			continue
		}
		var pr problem.Problem
		if err := json.Unmarshal(body, &pr); err != nil || pr.Code != "not_implemented" {
			t.Errorf("%s: body %s", p, body)
		}
		if res.header.Get("Content-Type") != problem.ContentType {
			t.Errorf("%s: Content-Type %q", p, res.header.Get("Content-Type"))
		}
	}
}

func TestStubRoutesRequireAToken(t *testing.T) {
	srv := newServer(t, nil)
	if res, _ := get(t, srv.URL+"/v1/consents/x", ""); res.status != http.StatusUnauthorized {
		t.Fatalf("status %d, want 401", res.status)
	}
	if res, _ := get(t, srv.URL+"/v1/consents/x", "wrong"); res.status != http.StatusUnauthorized {
		t.Fatalf("status %d, want 401", res.status)
	}
}

func TestHealthz(t *testing.T) {
	srv := newServer(t, map[string]Pinger{"postgres": pinger{errors.New("down")}})
	res, body := get(t, srv.URL+"/healthz", "")
	if res.status != http.StatusOK || !strings.Contains(string(body), `"ok"`) {
		t.Fatalf("status %d body %s", res.status, body)
	}
	if res.header.Get("X-Request-Id") == "" {
		t.Fatal("missing X-Request-Id")
	}
}

func TestReadyzWhenEverythingAnswers(t *testing.T) {
	srv := newServer(t, map[string]Pinger{"postgres": pinger{}, "redis": pinger{}})
	res, body := get(t, srv.URL+"/readyz", "")
	if res.status != http.StatusOK || !strings.Contains(string(body), `"ready"`) {
		t.Fatalf("status %d body %s", res.status, body)
	}
}

func TestReadyzNamesTheFailingDependencyOnly(t *testing.T) {
	srv := newServer(t, map[string]Pinger{
		"postgres": pinger{errors.New("dial tcp 10.0.0.5:5432: user fynk refused")},
		"redis":    pinger{},
	})
	res, body := get(t, srv.URL+"/readyz", "")
	if res.status != http.StatusServiceUnavailable {
		t.Fatalf("status %d", res.status)
	}
	var pr problem.Problem
	_ = json.Unmarshal(body, &pr)
	if pr.Code != "not_ready" || pr.Detail != "Unavailable: postgres" {
		t.Fatalf("problem %+v", pr)
	}
	if bytes.Contains(body, []byte("10.0.0.5")) {
		t.Fatalf("body leaks the error: %s", body)
	}
}

func TestUnknownRoutesAnswerProblemJSON(t *testing.T) {
	srv := newServer(t, nil)
	res, body := get(t, srv.URL+"/nope", "")
	if res.status != http.StatusNotFound || !strings.Contains(string(body), "not_found") {
		t.Fatalf("status %d body %s", res.status, body)
	}
}

func TestNewRouterRejectsDuplicateModules(t *testing.T) {
	dup := []Module{module.Stub{ModuleName: "bank"}, module.Stub{ModuleName: "bank"}}
	if _, err := NewRouter(quiet, dup, nil); err == nil {
		t.Fatal("expected an error for a duplicate module")
	}
}

func TestGeneratedHealthPathsArePublicAndAnswerFromTheContract(t *testing.T) {
	srv := newServer(t, nil)
	for _, m := range All(Deps{}) {
		switch m.Name() {
		case "identity", "backup", "recommendations":
			continue // these modules replaced the example path with their real endpoints
		}
		res, body := get(t, srv.URL+"/v1/"+m.Name()+"/health", "")
		if res.status != http.StatusOK {
			t.Errorf("%s: status %d, want 200", m.Name(), res.status)
			continue
		}
		var got struct{ Module, Status string }
		if err := json.Unmarshal(body, &got); err != nil || got.Module != m.Name() || got.Status != "stub" {
			t.Errorf("%s: body %s", m.Name(), body)
		}
	}
}

type fakeAuditVerifier struct {
	res audit.VerificationResult
	err error
}

func (f fakeAuditVerifier) Verify(context.Context) (audit.VerificationResult, error) {
	return f.res, f.err
}

func TestInternalAuditVerifyEndpoint(t *testing.T) {
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })

	verifier := fakeAuditVerifier{
		res: audit.VerificationResult{Valid: true, Count: 10, HeadHash: "0123456789abcdef"},
	}
	h, err := NewRouter(quiet, All(Deps{}), nil, WithAuditVerifier(verifier))
	if err != nil {
		t.Fatalf("NewRouter: %v", err)
	}
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)

	// 1. Unauthenticated request rejected with 401
	res, _ := get(t, srv.URL+"/internal/audit/verify", "")
	if res.status != http.StatusUnauthorized {
		t.Fatalf("expected 401 for unauthenticated request, got %d", res.status)
	}

	// 2. Authenticated request succeeds with 200 and result
	res, body := get(t, srv.URL+"/internal/audit/verify", auth.DevToken)
	if res.status != http.StatusOK {
		t.Fatalf("expected 200 for authenticated request, got %d", res.status)
	}
	var out audit.VerificationResult
	if err := json.Unmarshal(body, &out); err != nil || !out.Valid || out.Count != 10 {
		t.Fatalf("unexpected response body: %s", string(body))
	}
}
