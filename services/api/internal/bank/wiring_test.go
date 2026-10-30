package bank

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

func linkSettings(t *testing.T) config.Config {
	t.Helper()
	dir := t.TempDir()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	signer := filepath.Join(dir, "signer.pem")
	pemKey := pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)})
	if err := os.WriteFile(signer, pemKey, 0o600); err != nil {
		t.Fatal(err)
	}
	fp := filepath.Join(dir, "fp.key")
	if err := os.WriteFile(fp, make([]byte, 32), 0o600); err != nil {
		t.Fatal(err)
	}
	return config.Config{
		EgressURL: "https://caddy:8443", BankSignerKeyFile: signer, BankFingerprintKeyFile: fp,
		BankRedirectURI: "fynk://bank/callback", BancoDemoClientID: "fynk",
		BancoDemoIssuer: "https://bank.example", BancoDemoAuthorizeURL: "https://bank.example/authorize",
	}
}

func deps(c config.Config) module.Deps {
	return module.Deps{
		Config: c, Clock: clock.NewFixed(time.Date(2026, 10, 29, 15, 0, 0, 0, time.UTC)),
		Log: slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
}

func TestWithEverySettingBothDemoProvidersAreBuiltAndTheRevokerIsInstalled(t *testing.T) {
	t.Cleanup(func() { ports.InstallRevoker(nil) })
	providers, fingerprints, err := bankDemoProviders(deps(linkSettings(t)))
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := providers.Provider("banco-demo"); !ok {
		t.Fatal("no Banco Demo")
	}
	if _, ok := providers.Provider("billetera-demo"); !ok {
		t.Fatal("no Billetera Demo")
	}
	if _, ok := providers.Provider("bancolombia"); ok {
		t.Fatal("Bancolombia must stay out until its spike")
	}
	if fingerprints == nil {
		t.Fatal("no fingerprinter")
	}
	if _, ok := ports.InstalledRevoker().(revoker); !ok {
		t.Fatal("the real revoker is not installed for M4")
	}
}

func TestAMissingSettingDisablesTheLinkAndKeepsTheUnavailableRevoker(t *testing.T) {
	ports.InstallRevoker(nil)
	full := linkSettings(t)
	for name, drop := range map[string]func(*config.Config){
		"egress":       func(c *config.Config) { c.EgressURL = "" },
		"signer":       func(c *config.Config) { c.BankSignerKeyFile = "" },
		"fingerprint":  func(c *config.Config) { c.BankFingerprintKeyFile = "" },
		"client id":    func(c *config.Config) { c.BancoDemoClientID = "" },
		"issuer":       func(c *config.Config) { c.BancoDemoIssuer = "" },
		"authorize":    func(c *config.Config) { c.BancoDemoAuthorizeURL = "" },
		"missing file": func(c *config.Config) { c.BankSignerKeyFile = "/nope/signer.pem" },
	} {
		c := full
		drop(&c)
		if p, _, err := bankDemoProviders(deps(c)); err == nil || p != nil {
			t.Errorf("%s: want the link disabled, got %v %v", name, p, err)
		}
	}
	if err := ports.InstalledRevoker().RevokeConsent(context.Background(), "banco-demo", "x"); !errors.Is(err, ports.ErrProviderUnavailable) {
		t.Fatalf("revoker: got %v, want provider_unavailable", err)
	}
}
