//go:build integration

// Contract tests against Bancolombia's real Open Finance sandbox (API Market). They need the
// sandbox credentials of Fynk's application, never committed:
//
//	cd services/api
//	BANCOLOMBIA_CLIENT_ID=... BANCOLOMBIA_CLIENT_SECRET=... \
//	  go test -tags integration -count=1 -v -run Sandbox ./internal/bank/adapters/bancolombia/
//
// The resource server requires mTLS with a client certificate issued by the sandbox's own test
// CA ("Ozone Unsecured Certificates", NON-PROD-ONLY), which Bancolombia gives to each app. In
// staging the Caddy egress presents it; here, point BANCOLOMBIA_SANDBOX_CERT_FILE and
// BANCOLOMBIA_SANDBOX_KEY_FILE at its PEM files (in certs/, never committed). Without them the
// resource calls answer 401 invalid_client (ADR 0003, finding 7).
//
// The sandbox is a set of mocks: each API answers its documented examples, chosen by the value
// of the authorization header or the account id, so these tests use those documented values
// ("4uth0r1z4t100n" and friends) instead of a person's token. They prove that Fynk reaches the
// sandbox with its credentials and reads its real answers. See docs/adr/0003.
package bancolombia

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// The sandbox hosts documented in the API Market (Open Banking Authorization and Account
// Information). Override with BANCOLOMBIA_SANDBOX_*_URL if they change.
const (
	sandboxAuth      = "https://as1-api-open-finance-sandbox.ambientesbc.com"
	sandboxAPI       = "https://rs1-api-open-finance-sandbox.ambientesbc.com"
	sandboxDiscovery = "https://auth1-api-open-finance-sandbox.ambientesbc.com/.well-known/openid-configuration"
)

// Documented sandbox example values (public in the API Market), not credentials.
const (
	sandboxTokenOK      = "4uth0r1z4t100n"
	sandboxTokenRevoked = "567hfy2dv5r3v"
	sandboxAccountOK    = "abcd1234ok"
)

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func sandbox(t *testing.T) *Adapter {
	t.Helper()
	id, secret := os.Getenv("BANCOLOMBIA_CLIENT_ID"), os.Getenv("BANCOLOMBIA_CLIENT_SECRET")
	if id == "" || secret == "" {
		t.Skip("BANCOLOMBIA_CLIENT_ID and BANCOLOMBIA_CLIENT_SECRET are not set")
	}
	a, err := New(Config{
		AuthBaseURL:     envOr("BANCOLOMBIA_SANDBOX_AUTH_URL", sandboxAuth),
		ResourceBaseURL: envOr("BANCOLOMBIA_SANDBOX_API_URL", sandboxAPI),
		ClientID:        id, ClientSecret: secret,
		Audience: "sandbox", AuthorizeURL: "https://sandbox/authorize",
		Owner:   Owner{IDType: "CC", ID: "78965432", Name: "Pepito Perez"},
		Sandbox: true, Signer: &signer{}, HTTP: sandboxHTTP(t),
		Clock: clock.NewFixed(time.Now()),
	})
	if err != nil {
		t.Fatal(err)
	}
	return a
}

// sandboxHTTP presents the sandbox client certificate when its files are set, as the egress does.
func sandboxHTTP(t *testing.T) *http.Client {
	t.Helper()
	c := &http.Client{Timeout: 20 * time.Second}
	certFile, keyFile := os.Getenv("BANCOLOMBIA_SANDBOX_CERT_FILE"), os.Getenv("BANCOLOMBIA_SANDBOX_KEY_FILE")
	if certFile == "" || keyFile == "" {
		t.Log("no BANCOLOMBIA_SANDBOX_CERT_FILE/KEY_FILE: resource calls will be refused without mTLS")
		return c
	}
	cert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		t.Fatalf("sandbox client certificate: %v", err)
	}
	c.Transport = &http.Transport{TLSClientConfig: &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12}}
	return c
}

// The discovery document gives the issuer and the authorization endpoint for the settings
// BANCOLOMBIA_ISSUER and BANCOLOMBIA_AUTHORIZE_URL.
func TestSandboxDiscoveryNamesTheEndpoints(t *testing.T) {
	a := sandbox(t)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, envOr("BANCOLOMBIA_SANDBOX_DISCOVERY_URL", sandboxDiscovery), nil)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	a.credentials(req)
	res, err := a.cfg.HTTP.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer drain(res)
	if res.StatusCode != http.StatusOK {
		t.Fatalf("discovery status %d", res.StatusCode)
	}
	var d struct {
		Issuer        string `json:"issuer"`
		Authorization string `json:"authorization_endpoint"`
		Token         string `json:"token_endpoint"`
		PAR           string `json:"pushed_authorization_request_endpoint"`
	}
	if err := json.NewDecoder(res.Body).Decode(&d); err != nil {
		t.Fatal(err)
	}
	if d.Issuer == "" || d.Authorization == "" || d.PAR == "" {
		t.Fatalf("discovery %+v", d)
	}
	t.Logf("BANCOLOMBIA_ISSUER=%s", d.Issuer)
	t.Logf("BANCOLOMBIA_AUTHORIZE_URL=%s", d.Authorization)
	t.Logf("token endpoint %s, PAR endpoint %s", d.Token, d.PAR)
}

func TestSandboxAccountsAndBalances(t *testing.T) {
	a := sandbox(t)
	accounts, err := a.Accounts(context.Background(), sandboxTokenOK)
	if err != nil {
		t.Fatal(err)
	}
	if len(accounts) == 0 {
		t.Fatal("no accounts")
	}
	for _, acc := range accounts {
		if acc.ProviderAccountID == "" || len(acc.Last4) != 4 || !acc.IsSimulated {
			t.Fatalf("account %+v", acc)
		}
		t.Logf("%s %s ****%s balance %d centavos", acc.Kind, acc.DisplayName, acc.Last4, acc.BalanceMinor)
	}
}

func TestSandboxTransactions(t *testing.T) {
	a := sandbox(t)
	page, err := a.Transactions(context.Background(), sandboxTokenOK, sandboxAccountOK, time.Now().Add(-History), "")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) == 0 {
		t.Fatal("no movements")
	}
	for _, tx := range page.Items {
		if tx.ProviderTxID == "" || tx.AmountMinor == 0 || tx.BookedAt.IsZero() {
			t.Fatalf("movement %+v", tx)
		}
	}
	t.Logf("%d movements, next page %q", len(page.Items), page.NextCursor)
}

func TestSandboxARevokedConsentIsConsentRevoked(t *testing.T) {
	a := sandbox(t)
	if _, err := a.Accounts(context.Background(), sandboxTokenRevoked); !errors.Is(err, ports.ErrConsentRevoked) {
		t.Fatalf("got %v, want consent_revoked", err)
	}
}
