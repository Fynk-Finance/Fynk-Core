package bank

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

func newAPI(t *testing.T) *httptest.Server {
	t.Helper()
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	r := chi.NewRouter()
	r.Route("/v1", New(module.Deps{}).Routes)
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

type reply struct {
	status int
	body   []byte
}

func call(t *testing.T, method, url, token, body string) reply {
	t.Helper()
	req, _ := http.NewRequestWithContext(context.Background(), method, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, url, err)
	}
	b, _ := io.ReadAll(res.Body)
	_ = res.Body.Close()
	return reply{res.StatusCode, b}
}

func code(t *testing.T, b []byte) string {
	t.Helper()
	var p problem.Problem
	if err := json.Unmarshal(b, &p); err != nil {
		t.Fatalf("not problem JSON: %s", b)
	}
	return p.Code
}

// HU-009: the app gets the entities to choose from, with the "Simulado" flag and the scopes.
func TestProvidersListsTheSimulatedBankAndWallet(t *testing.T) {
	srv := newAPI(t)
	res := call(t, http.MethodGet, srv.URL+"/v1/providers", auth.DevToken, "")
	if res.status != http.StatusOK {
		t.Fatalf("%d %s", res.status, res.body)
	}
	var got struct {
		Items []struct {
			ID              string   `json:"id"`
			DisplayName     string   `json:"displayName"`
			Kind            string   `json:"kind"`
			IsSimulated     bool     `json:"isSimulated"`
			SupportedScopes []string `json:"supportedScopes"`
			LogoKey         string   `json:"logoKey"`
		} `json:"items"`
	}
	if err := json.Unmarshal(res.body, &got); err != nil || len(got.Items) != 2 {
		t.Fatalf("body %s", res.body)
	}
	bd, bi := got.Items[0], got.Items[1]
	if bd.ID != "banco-demo" || bd.DisplayName != "Banco Demo" || bd.Kind != "bank" || !bd.IsSimulated ||
		strings.Join(bd.SupportedScopes, ",") != "balances,transactions,account_details" || bd.LogoKey != "banco-demo" {
		t.Errorf("banco-demo %+v", bd)
	}
	if bi.ID != "billetera-demo" || bi.Kind != "wallet" || !bi.IsSimulated {
		t.Errorf("billetera-demo %+v", bi)
	}
}

func TestEveryRouteNeedsATokenBeforeTheRequestIsParsed(t *testing.T) {
	srv := newAPI(t)
	for _, p := range []struct{ method, path string }{
		{http.MethodGet, "/v1/providers"},
		{http.MethodPost, "/v1/bank/authorizations"},
		{http.MethodPost, "/v1/bank/authorizations/not-a-uuid/exchange"},
		{http.MethodPost, "/v1/bank/accounts/query"},
		{http.MethodPost, "/v1/bank/transactions/query"},
		{http.MethodPost, "/v1/bank/tokens/refresh"},
	} {
		if res := call(t, p.method, srv.URL+p.path, "", "{}"); res.status != http.StatusUnauthorized || code(t, res.body) != "unauthorized" {
			t.Errorf("%s %s: %d %s", p.method, p.path, res.status, res.body)
		}
	}
	if res := call(t, http.MethodGet, srv.URL+"/v1/bank/health", "", ""); res.status != http.StatusOK {
		t.Errorf("health: %d, want 200 without a token", res.status)
	}
}

// Without the bank link settings, starting a link fails closed with provider_unavailable.
func TestTheLinkAnswersProviderUnavailableWithoutItsSettings(t *testing.T) {
	srv := newAPI(t)
	bodies := map[string]string{
		"/v1/bank/authorizations": `{"provider":"banco-demo","consentId":"0192f0a0-0000-7000-8000-000000000001",` +
			`"codeChallenge":"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM","codeChallengeMethod":"S256","state":"9b2f6c1e4a7d"}`,
		"/v1/bank/authorizations/0192f0a0-0000-7000-8000-000000000002/exchange": `{"code":"c","codeVerifier":"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"}`,
	}
	for path, body := range bodies {
		res := call(t, http.MethodPost, srv.URL+path, auth.DevToken, body)
		if res.status != http.StatusServiceUnavailable || code(t, res.body) != "provider_unavailable" {
			t.Errorf("%s: %d %s", path, res.status, res.body)
		}
	}
}

// The query and refresh endpoints are in the contract (so the app can use the Prism mock) but
// answer 501 until the next part of M5 step 2.
func TestTheQueryAndRefreshEndpointsAnswer501UntilTheirPart(t *testing.T) {
	srv := newAPI(t)
	bodies := map[string]string{
		"/v1/bank/accounts/query": `{"linkId":"0192f0a0-0000-7000-8000-000000000003","accessToken":"t"}`,
		"/v1/bank/transactions/query": `{"linkId":"0192f0a0-0000-7000-8000-000000000003","accessToken":"t",` +
			`"providerAccountId":"acc-1","since":"2026-01-01T00:00:00Z"}`,
		"/v1/bank/tokens/refresh": `{"linkId":"0192f0a0-0000-7000-8000-000000000003","refreshToken":"r"}`,
	}
	for path, body := range bodies {
		res := call(t, http.MethodPost, srv.URL+path, auth.DevToken, body)
		if res.status != http.StatusNotImplemented || code(t, res.body) != "not_implemented" {
			t.Errorf("%s: %d %s", path, res.status, res.body)
		}
		if strings.Contains(string(res.body), `"t"`) || strings.Contains(string(res.body), "accessToken") {
			t.Errorf("%s: the answer echoes the request: %s", path, res.body)
		}
	}
}
