package bank

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

const testSub = "sub-secret-4f2a"

type subVerifier struct{}

func (subVerifier) Verify(context.Context, string, string) (auth.User, error) {
	return auth.User{ID: testSub, EmailVerified: true}, nil
}

type stubProvisioner struct {
	ids  []string
	err  error
	subs []string
}

func (s *stubProvisioner) Provision(_ context.Context, sub string) ([]string, error) {
	s.subs = append(s.subs, sub)
	return s.ids, s.err
}

// newSimulatedAPI serves the module with a verifier that gives the caller a known sub and a log
// captured in logs.
func newSimulatedAPI(t *testing.T, p ports.DemoProvisioner) (*httptest.Server, *bytes.Buffer) {
	t.Helper()
	auth.Install(subVerifier{})
	ports.InstallDemoProvisioner(p)
	t.Cleanup(func() {
		auth.Install(nil)
		ports.InstallDemoProvisioner(nil)
	})
	logs := &bytes.Buffer{}
	r := chi.NewRouter()
	r.Route("/v1", New(module.Deps{Log: slog.New(slog.NewTextHandler(logs, nil))}).Routes)
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv, logs
}

// HU-058: the endpoint returns what the simulator returns, in catalog order, and sends the
// caller's sub (the Keycloak id) to the provisioner.
func TestSimulatedEntitiesReturnWhatTheSimulatorReturns(t *testing.T) {
	p := &stubProvisioner{ids: []string{"cooperativa-demo", "banco-demo", "unknown-bank", "banco-demo"}}
	srv, _ := newSimulatedAPI(t, p)
	res := call(t, http.MethodGet, srv.URL+"/v1/bank/simulated-entities", "any", "")
	if res.status != http.StatusOK {
		t.Fatalf("%d %s", res.status, res.body)
	}
	var got struct {
		ProviderIDs []string `json:"providerIds"`
	}
	if err := json.Unmarshal(res.body, &got); err != nil {
		t.Fatal(err)
	}
	if strings.Join(got.ProviderIDs, ",") != "banco-demo,cooperativa-demo" {
		t.Fatalf("providerIds %v, want the catalog ones in catalog order", got.ProviderIDs)
	}
	if len(p.subs) != 1 || p.subs[0] != testSub {
		t.Fatalf("provisioner called with %v, want the caller's sub", p.subs)
	}
}

func TestSimulatedEntitiesNeedAToken(t *testing.T) {
	srv, _ := newSimulatedAPI(t, &stubProvisioner{})
	if res := call(t, http.MethodGet, srv.URL+"/v1/bank/simulated-entities", "", ""); res.status != http.StatusUnauthorized {
		t.Fatalf("%d %s", res.status, res.body)
	}
}

// Without the simulator the app gets 503 provider_unavailable and falls back to every entity.
func TestSimulatedEntitiesAnswerProviderUnavailableWhenDisabledOrFailing(t *testing.T) {
	for name, p := range map[string]ports.DemoProvisioner{
		"disabled": nil,
		"failing":  &stubProvisioner{err: errors.Join(ports.ErrProviderUnavailable, errors.New("boom"))},
	} {
		srv, logs := newSimulatedAPI(t, p)
		res := call(t, http.MethodGet, srv.URL+"/v1/bank/simulated-entities", "any", "")
		if res.status != http.StatusServiceUnavailable || code(t, res.body) != "provider_unavailable" {
			t.Errorf("%s: %d %s", name, res.status, res.body)
		}
		if strings.Contains(logs.String(), testSub) || strings.Contains(string(res.body), testSub) {
			t.Errorf("%s: the sub leaked: %s %s", name, logs, res.body)
		}
	}
}

// An unexpected provisioner error is a 500 without details, and the log has no sub.
func TestSimulatedEntitiesNeverLogTheSubOnAnUnexpectedError(t *testing.T) {
	srv, logs := newSimulatedAPI(t, &stubProvisioner{err: errors.New("unexpected")})
	res := call(t, http.MethodGet, srv.URL+"/v1/bank/simulated-entities", "any", "")
	if res.status != http.StatusInternalServerError {
		t.Fatalf("%d %s", res.status, res.body)
	}
	if strings.Contains(logs.String(), testSub) || strings.Contains(string(res.body), testSub) {
		t.Fatalf("the sub leaked: %s %s", logs, res.body)
	}
}
