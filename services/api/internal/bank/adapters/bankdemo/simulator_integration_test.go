//go:build integration

// Contract tests of the Banco Demo adapter against the running simulator, through the Caddy
// egress, plus the mTLS checks of HU-031. Start the stack with `make certs` and
// `docker compose up -d bank-simulator caddy`, then run from the repository root:
//
//	docker run --rm --network fynk_default -v "$PWD":/src -w /src/services/api \
//	  -e BANKDEMO_EGRESS_URL=https://caddy:8443 -e BANKDEMO_CA=/src/certs/ca.crt \
//	  -e BANKDEMO_DIRECT_URL=https://bank-simulator:9443 \
//	  -e BANKDEMO_CLIENT_CERT=/src/certs/fynk-client.crt -e BANKDEMO_CLIENT_KEY=/src/certs/fynk-client.key \
//	  golang:1.27.3-bookworm go test -tags integration -count=1 -run Simulator ./internal/bank/adapters/bankdemo/
//
// From the host only the egress is reachable (BANKDEMO_EGRESS_URL=https://localhost:8443 and
// BANKDEMO_CA=$PWD/certs/ca.crt, an absolute path because go test runs in the package folder):
// the direct mTLS listener is not published, as in AWS, so those tests skip. BANKDEMO_ALLOW_REVOKE=1 also runs the revocation test, which revokes the
// demo consent in the simulator until it restarts (docker compose restart bank-simulator).
package bankdemo

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/egress"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// The simulator accepts its static demo token on the resource API until the authorization
// page exists (M16), which is the only way to read the demo user's data today.
const demoToken = "dev-token"

// ps256Signer signs a real private_key_jwt assertion with a throwaway RSA key.
type ps256Signer struct{ key *rsa.PrivateKey }

func (s ps256Signer) ClientAssertion(_ context.Context, audience string) (string, error) {
	enc := base64.RawURLEncoding
	header, _ := json.Marshal(map[string]string{"alg": "PS256", "typ": "JWT"})
	jti := make([]byte, 16)
	_, _ = rand.Read(jti)
	now := time.Now()
	claims, _ := json.Marshal(map[string]any{
		"iss": "fynk", "sub": "fynk", "aud": audience, "jti": enc.EncodeToString(jti),
		"iat": now.Unix(), "exp": now.Add(60 * time.Second).Unix(),
	})
	input := enc.EncodeToString(header) + "." + enc.EncodeToString(claims)
	sum := sha256.Sum256([]byte(input))
	sig, err := rsa.SignPSS(rand.Reader, s.key, crypto.SHA256, sum[:], &rsa.PSSOptions{SaltLength: rsa.PSSSaltLengthEqualsHash})
	if err != nil {
		return "", err
	}
	return input + "." + enc.EncodeToString(sig), nil
}

func simulator(t *testing.T, provider string) *Adapter {
	t.Helper()
	egressURL := os.Getenv("BANKDEMO_EGRESS_URL")
	if egressURL == "" {
		t.Skip("BANKDEMO_EGRESS_URL is not set (see the comment at the top of this file)")
	}
	client, err := egress.NewClient(os.Getenv("BANKDEMO_CA"))
	if err != nil {
		t.Fatal(err)
	}
	base, _ := egress.BaseURL(strings.TrimRight(egressURL, "/"), "banco-demo")
	key, _ := rsa.GenerateKey(rand.Reader, 2048)
	a, err := New(Config{
		Provider: provider, BaseURL: base, ClientID: "fynk",
		Audience:     "http://localhost:8081/realms/banco-demo",
		AuthorizeURL: "http://localhost:8081/realms/banco-demo/protocol/openid-connect/auth",
		RedirectURI:  "fynk://bank/callback",
		Signer:       ps256Signer{key: key}, HTTP: client, Clock: clock.System{},
	})
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func TestSimulatorServesTheCDTCatalogThroughTheEgress(t *testing.T) {
	products, err := simulator(t, "banco-demo").Products(context.Background())
	if err != nil || len(products) == 0 {
		t.Fatalf("products %+v, %v", products, err)
	}
	for _, p := range products {
		if p.ID == "" || p.TermDays <= 0 || p.RateEaBps <= 0 || p.MinAmountMinor <= 0 {
			t.Errorf("product %+v", p)
		}
	}
}

// Reference numbers of M16: Ahorros 3.200.000, Billetera 4.600.000, card owed 500.000, CDT 2.000.000.
func TestSimulatorAccountsMatchTheSeededDemoUser(t *testing.T) {
	ctx := context.Background()
	bank, err := simulator(t, "banco-demo").Accounts(ctx, demoToken)
	if err != nil {
		t.Fatalf("banco-demo: %v (if the demo consent was revoked, restart the simulator)", err)
	}
	byKind := map[ports.AccountKind]ports.Account{}
	for _, a := range bank {
		byKind[a.Kind] = a
	}
	if len(bank) != 3 || byKind[ports.AccountSavings].BalanceMinor != 320000000 ||
		byKind[ports.AccountCreditCard].BalanceMinor != 50000000 || byKind[ports.AccountCDT].BalanceMinor != 200000000 {
		t.Errorf("banco-demo %+v", bank)
	}
	wallet, err := simulator(t, "billetera-demo").Accounts(ctx, demoToken)
	if err != nil || len(wallet) != 1 || wallet[0].BalanceMinor != 460000000 {
		t.Fatalf("billetera-demo %+v, %v", wallet, err)
	}
	for _, a := range append(bank, wallet...) {
		if !a.IsSimulated || len(a.Last4) != 4 {
			t.Errorf("%s: simulated %v last4 %q", a.ProviderAccountID, a.IsSimulated, a.Last4)
		}
	}
	// The simulator also sends the customer's email and the masked number: neither leaves.
	b, _ := json.Marshal(append(bank, wallet...))
	if strings.Contains(string(b), "@") || strings.Contains(string(b), "****") {
		t.Fatalf("personal data left the adapter: %s", b)
	}
}

// HU-010: 12 months of history, paged by cursor without duplicates.
func TestSimulatorTransactionsPageThroughTwelveMonths(t *testing.T) {
	ctx := context.Background()
	a := simulator(t, "banco-demo")
	accounts, err := a.Accounts(ctx, demoToken)
	if err != nil {
		t.Fatal(err)
	}
	var savings string
	for _, acc := range accounts {
		if acc.Kind == ports.AccountSavings {
			savings = acc.ProviderAccountID
		}
	}
	since := time.Now().AddDate(-1, 0, 0)
	seen := map[string]bool{}
	salaries, cursor, pages := 0, "", 0
	for {
		page, err := a.Transactions(ctx, demoToken, savings, since, cursor)
		if err != nil {
			t.Fatal(err)
		}
		pages++
		for _, tx := range page.Items {
			if seen[tx.ProviderTxID] {
				t.Fatalf("duplicate %s on page %d", tx.ProviderTxID, pages)
			}
			seen[tx.ProviderTxID] = true
			if tx.BookedAt.Before(since.Add(-24 * time.Hour)) {
				t.Errorf("%s booked %v, before %v", tx.ProviderTxID, tx.BookedAt, since)
			}
			if tx.AmountMinor == 520000000 {
				salaries++
			}
		}
		if page.NextCursor == "" || pages > 100 {
			break
		}
		cursor = page.NextCursor
	}
	if len(seen) == 0 || salaries < 11 {
		t.Fatalf("%d movements in %d pages, %d salaries in 12 months", len(seen), pages, salaries)
	}
}

// HU-030: PAR with PKCE S256 and a PS256 private_key_jwt.
func TestSimulatorAcceptsThePARAndReturnsTheAuthorizeURL(t *testing.T) {
	res, err := simulator(t, "banco-demo").PushAuthorization(context.Background(), ports.PARRequest{
		RedirectURI: "fynk://bank/callback", CodeChallenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
		State: "state-it", Nonce: "nonce-it", ConsentID: "0192f0a0-0000-7000-8000-000000000001",
		Scopes: []ports.Scope{ports.ScopeBalances, ports.ScopeTransactions, ports.ScopeAccountDetails},
	})
	if err != nil || !strings.Contains(res.AuthorizeURL, "request_uri=urn%3Aietf%3Aparams%3Aoauth%3Arequest_uri%3A") || res.ExpiresIn <= 0 {
		t.Fatalf("PAR %+v, %v", res, err)
	}
}

// HU-031: the bank accepts only clients with Fynk's certificate, which only Caddy holds.
func TestSimulatorDirectListenerNeedsTheClientCertificate(t *testing.T) {
	direct := os.Getenv("BANKDEMO_DIRECT_URL")
	if direct == "" {
		t.Skip("BANKDEMO_DIRECT_URL is not set: the mTLS listener is reachable only inside the Docker network")
	}
	pem, err := os.ReadFile(os.Getenv("BANKDEMO_CA"))
	if err != nil {
		t.Fatal(err)
	}
	roots := x509.NewCertPool()
	roots.AppendCertsFromPEM(pem)
	get := func(certs []tls.Certificate) error {
		c := &http.Client{Timeout: 10 * time.Second, Transport: &http.Transport{TLSClientConfig: &tls.Config{
			RootCAs: roots, Certificates: certs, ServerName: "bank-simulator", MinVersion: tls.VersionTLS12,
		}}}
		res, err := c.Get(direct + "/healthz")
		if err != nil {
			return err
		}
		_ = res.Body.Close()
		if res.StatusCode != http.StatusOK {
			return errors.New(res.Status)
		}
		return nil
	}
	if err := get(nil); err == nil {
		t.Fatal("the bank answered a client without a certificate")
	}
	cert, err := tls.LoadX509KeyPair(os.Getenv("BANKDEMO_CLIENT_CERT"), os.Getenv("BANKDEMO_CLIENT_KEY"))
	if err != nil {
		t.Fatal(err)
	}
	if err := get([]tls.Certificate{cert}); err != nil {
		t.Fatalf("with Fynk's client certificate: %v", err)
	}
}

// HU-008 and Gate C: after the revocation reaches the bank, the next query is consent_revoked.
// It must run last: it revokes the demo consent until the simulator restarts.
func TestSimulatorRevocationStopsTheNextQuery(t *testing.T) {
	if os.Getenv("BANKDEMO_ALLOW_REVOKE") != "1" {
		t.Skip("BANKDEMO_ALLOW_REVOKE=1 is not set: this test revokes the demo consent")
	}
	ctx := context.Background()
	a := simulator(t, "banco-demo")
	if err := a.RevokeConsent(ctx, "consent-demo-001"); err != nil {
		t.Fatalf("revoke: %v", err)
	}
	if _, err := a.Accounts(ctx, demoToken); !errors.Is(err, ports.ErrConsentRevoked) {
		t.Fatalf("after revoke: err = %v, want consent_revoked", err)
	}
}
