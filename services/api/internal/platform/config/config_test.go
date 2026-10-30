package config

import (
	"strings"
	"testing"
)

func env(m map[string]string) func(string) string {
	return func(k string) string { return m[k] }
}

func TestLoadReadsEveryValue(t *testing.T) {
	c, err := Load(env(map[string]string{
		"APP_ENV":           "local",
		"PORT":              "9000",
		"DATABASE_URL":      "postgres://x",
		"REDIS_URL":         "redis://x",
		"KEYCLOAK_ISSUER":   "http://kc/realms/fynk",
		"KEYCLOAK_AUDIENCE": "fynk-api",
		"KEYCLOAK_URL":      "http://keycloak:8080",
		"KEYCLOAK_REALM":    "fynk",
		"EGRESS_URL":        "https://caddy:8443/",
		"EGRESS_CA_FILE":    "/certs/ca.crt",
	}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	want := Config{
		AppEnv: EnvLocal, Port: "9000", DatabaseURL: "postgres://x", RedisURL: "redis://x",
		KeycloakIssuer: "http://kc/realms/fynk", KeycloakAudience: "fynk-api",
		KeycloakURL: "http://keycloak:8080", KeycloakRealm: "fynk",
		EgressURL: "https://caddy:8443", EgressCAFile: "/certs/ca.crt",
		BankRedirectURI: "fynk://bank/callback",
	}
	if c != want {
		t.Fatalf("got %+v, want %+v", c, want)
	}
	if !c.IsLocal() {
		t.Fatal("IsLocal() = false for local")
	}
}

func TestLoadDefaultsThePort(t *testing.T) {
	c, err := Load(env(map[string]string{"APP_ENV": "prod", "DATABASE_URL": "d", "REDIS_URL": "r"}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if c.Port != "8080" {
		t.Fatalf("Port = %q, want 8080", c.Port)
	}
	if c.KeycloakRealm != "fynk" {
		t.Fatalf("KeycloakRealm = %q, want fynk", c.KeycloakRealm)
	}
	if c.IsLocal() {
		t.Fatal("IsLocal() = true for prod")
	}
}

func TestLoadRequiresAppEnvAndConnections(t *testing.T) {
	_, err := Load(env(map[string]string{}))
	if err == nil {
		t.Fatal("expected an error")
	}
	for _, part := range []string{"APP_ENV is required", "DATABASE_URL", "REDIS_URL"} {
		if !strings.Contains(err.Error(), part) {
			t.Errorf("error %q does not mention %q", err, part)
		}
	}
}

func TestLoadRejectsUnknownAppEnv(t *testing.T) {
	_, err := Load(env(map[string]string{"APP_ENV": "dev", "DATABASE_URL": "d", "REDIS_URL": "r"}))
	if err == nil || !strings.Contains(err.Error(), `"dev"`) {
		t.Fatalf("err = %v, want an unknown APP_ENV error", err)
	}
}

// The egress is optional, so staging starts before M14 sets it; when set it must be https.
func TestLoadAcceptsNoEgressAndRejectsAPlainHTTPOne(t *testing.T) {
	base := map[string]string{"APP_ENV": "staging", "DATABASE_URL": "d", "REDIS_URL": "r"}
	if c, err := Load(env(base)); err != nil || c.EgressURL != "" {
		t.Fatalf("without EGRESS_URL: %+v, %v", c, err)
	}
	base["EGRESS_URL"] = "http://caddy.internal"
	if _, err := Load(env(base)); err == nil || !strings.Contains(err.Error(), "EGRESS_URL must start with https://") {
		t.Fatalf("plain http: err = %v", err)
	}
}

func TestLoadReadsTheOptionalAdminClientSecret(t *testing.T) {
	base := map[string]string{"APP_ENV": "staging", "DATABASE_URL": "d", "REDIS_URL": "r"}
	c, err := Load(env(base))
	if err != nil || c.KeycloakAdminClientSecret != "" {
		t.Fatalf("without the secret: %q, %v", c.KeycloakAdminClientSecret, err)
	}
	base["FYNK_ADMIN_CLIENT_SECRET"] = "fake-admin-secret"
	c, err = Load(env(base))
	if err != nil || c.KeycloakAdminClientSecret != "fake-admin-secret" {
		t.Fatalf("with the secret: %q, %v", c.KeycloakAdminClientSecret, err)
	}
}

func TestLoadReadsTheBankLinkSettings(t *testing.T) {
	c, err := Load(env(map[string]string{
		"APP_ENV": "staging", "DATABASE_URL": "d", "REDIS_URL": "r",
		"BANK_SIGNER_KEY_FILE":      "/secrets/signer.pem",
		"BANK_FINGERPRINT_KEY_FILE": "/secrets/fingerprint.key",
		"BANK_REDIRECT_URI":         "fynk://bank/callback-staging",
		"BANCO_DEMO_CLIENT_ID":      "fynk",
		"BANCO_DEMO_ISSUER":         "https://bank.example/realms/banco-demo",
		"BANCO_DEMO_AUTHORIZE_URL":  "https://bank.example/oauth/authorize",
	}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if c.BankSignerKeyFile != "/secrets/signer.pem" || c.BankFingerprintKeyFile != "/secrets/fingerprint.key" ||
		c.BankRedirectURI != "fynk://bank/callback-staging" || c.BancoDemoClientID != "fynk" ||
		c.BancoDemoIssuer != "https://bank.example/realms/banco-demo" ||
		c.BancoDemoAuthorizeURL != "https://bank.example/oauth/authorize" {
		t.Fatalf("bank settings not read: %+v", c)
	}
}

func TestLoadLeavesTheBankLinkOffAndDefaultsTheRedirect(t *testing.T) {
	c, err := Load(env(map[string]string{"APP_ENV": "prod", "DATABASE_URL": "d", "REDIS_URL": "r"}))
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if c.BankSignerKeyFile != "" || c.BankFingerprintKeyFile != "" || c.BancoDemoClientID != "" {
		t.Fatalf("bank settings should be empty: %+v", c)
	}
	if c.BankRedirectURI != "fynk://bank/callback" {
		t.Fatalf("BankRedirectURI = %q, want fynk://bank/callback", c.BankRedirectURI)
	}
}

func TestLoadRejectsAPlainHTTPAuthorizePageOutsideLocal(t *testing.T) {
	base := map[string]string{"DATABASE_URL": "d", "REDIS_URL": "r", "BANCO_DEMO_AUTHORIZE_URL": "http://bank/authorize"}
	base["APP_ENV"] = "staging"
	if _, err := Load(env(base)); err == nil || !strings.Contains(err.Error(), "BANCO_DEMO_AUTHORIZE_URL") {
		t.Fatalf("want a BANCO_DEMO_AUTHORIZE_URL error in staging, got %v", err)
	}
	base["APP_ENV"] = "local"
	if _, err := Load(env(base)); err != nil {
		t.Fatalf("local may use http: %v", err)
	}
}
