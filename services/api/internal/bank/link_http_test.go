package bank

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/keys"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/service"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/store"
	consentports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

const (
	devDevice = "0b4f5d1e-9a3c-4c2e-8f1a-2d3e4f5a6b7c"
	pendingID = "0192f0a0-0000-7000-8000-0000000000a1"
	grantedID = "0192f0a0-0000-7000-8000-0000000000a2"
)

// httpBank is a bank for the HTTP tests: a fixed authorize URL and fixed tokens.
type httpBank struct{ ports.Provider }

func (httpBank) PushAuthorization(context.Context, ports.PARRequest) (ports.PARResult, error) {
	return ports.PARResult{AuthorizeURL: "https://bank.example/authorize?request_uri=urn:x"}, nil
}

func (httpBank) ExchangeCode(context.Context, ports.CodeExchange) (ports.TokenSet, error) {
	return ports.TokenSet{AccessToken: "access-1", RefreshToken: "refresh-1", ExpiresIn: 300 * time.Second}, nil
}

// httpConsents is M4 for the HTTP tests: one pending and one granted consent of dev-user.
type httpConsents struct{}

func (httpConsents) Pending(_ context.Context, _ string, id string) (consentports.Pending, error) {
	switch id {
	case pendingID:
		return consentports.Pending{ID: id, Provider: "banco-demo", Scopes: []string{"balances"}, TermDays: 365}, nil
	case grantedID:
		return consentports.Pending{}, consentports.ErrConsentNotPending
	}
	return consentports.Pending{}, consentports.ErrConsentNotFound
}
func (httpConsents) Active(context.Context, string, string) (bool, error) { return true, nil }
func (httpConsents) MarkGranted(context.Context, string, string) error    { return nil }

func newLinkAPI(t *testing.T) *httptest.Server {
	t.Helper()
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	c := clock.NewFixed(time.Date(2026, 10, 29, 15, 0, 0, 0, time.UTC))
	fp, _ := keys.NewLocalHMAC([]byte("0123456789abcdef0123456789abcdef"))
	svc := service.New(service.Deps{
		Providers: service.ProviderMap{"banco-demo": httpBank{}}, Pending: httpConsents{}, Consents: httpConsents{},
		Links: store.NewMemory(), Authorizations: store.NewMemoryAuthorizations(c), Fingerprints: fp,
		Clock: c, Log: slog.New(slog.NewTextHandler(io.Discard, nil)), RedirectURI: "fynk://bank/callback",
	})
	r := chi.NewRouter()
	r.Route("/v1", bankModule{svc: svc, deps: modDeps()}.Routes)
	srv := httptest.NewServer(r)
	t.Cleanup(srv.Close)
	return srv
}

func post(t *testing.T, url, device, body string) (int, http.Header, []byte) {
	t.Helper()
	req, _ := http.NewRequestWithContext(context.Background(), http.MethodPost, url, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+auth.DevToken)
	if device != "" {
		req.Header.Set("X-Device-Id", device)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(res.Body)
	_ = res.Body.Close()
	return res.StatusCode, res.Header, b
}

func startBody(consentID string) string {
	return `{"provider":"banco-demo","consentId":"` + consentID + `",` +
		`"codeChallenge":"E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM","codeChallengeMethod":"S256","state":"9b2f6c1e4a7d"}`
}

func TestStartingAndExchangingALinkOverHTTP(t *testing.T) {
	srv := newLinkAPI(t)
	status, header, body := post(t, srv.URL+"/v1/bank/authorizations", devDevice, startBody(pendingID))
	if status != http.StatusCreated {
		t.Fatalf("start: %d %s", status, body)
	}
	var started struct {
		AuthorizationID string `json:"authorizationId"`
		AuthorizeURL    string `json:"authorizeUrl"`
	}
	_ = json.Unmarshal(body, &started)
	if started.AuthorizeURL != "https://bank.example/authorize?request_uri=urn:x" || started.AuthorizationID == "" {
		t.Fatalf("start body: %s", body)
	}
	if header.Get("Cache-Control") != "no-store" {
		t.Fatal("bank answers must not be cached")
	}

	status, header, body = post(t, srv.URL+"/v1/bank/authorizations/"+started.AuthorizationID+"/exchange", devDevice,
		`{"code":"c","codeVerifier":"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"}`)
	if status != http.StatusOK {
		t.Fatalf("exchange: %d %s", status, body)
	}
	var tokens map[string]any
	_ = json.Unmarshal(body, &tokens)
	if tokens["accessToken"] != "access-1" || tokens["refreshToken"] != "refresh-1" ||
		tokens["expiresIn"] != float64(300) || tokens["provider"] != "banco-demo" || tokens["linkId"] == "" {
		t.Fatalf("exchange body: %s", body)
	}
	if header.Get("Cache-Control") != "no-store" {
		t.Fatal("the tokens must not be cached")
	}

	status, _, body = post(t, srv.URL+"/v1/bank/authorizations/"+started.AuthorizationID+"/exchange", devDevice,
		`{"code":"c","codeVerifier":"dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"}`)
	if status != http.StatusNotFound || code(t, body) != "authorization_not_found" {
		t.Fatalf("second exchange: %d %s", status, body)
	}
}

func TestTheLinkErrorsHaveTheirCodes(t *testing.T) {
	srv := newLinkAPI(t)
	cases := []struct {
		name, device, consent string
		status                int
		code                  string
	}{
		{"no device", "", pendingID, http.StatusUnprocessableEntity, "device_required"},
		{"unknown consent", devDevice, "0192f0a0-0000-7000-8000-0000000000ff", http.StatusNotFound, "consent_not_found"},
		{"consent already granted", devDevice, grantedID, http.StatusConflict, "consent_not_pending"},
	}
	for _, c := range cases {
		status, _, body := post(t, srv.URL+"/v1/bank/authorizations", c.device, startBody(c.consent))
		if status != c.status || code(t, body) != c.code {
			t.Errorf("%s: %d %s, want %d %s", c.name, status, body, c.status, c.code)
		}
	}
}

func modDeps() module.Deps { return module.Deps{Log: slog.New(slog.NewTextHandler(io.Discard, nil))} }
