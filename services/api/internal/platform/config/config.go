// Package config reads the API settings from environment variables.
package config

import (
	"errors"
	"fmt"
	"strings"
)

// Env is the deployment environment.
type Env string

// Environments. Only EnvLocal enables development shortcuts such as the dev-token.
const (
	EnvLocal   Env = "local"
	EnvStaging Env = "staging"
	EnvProd    Env = "prod"
)

// Config holds every setting the API needs. Secrets come from the environment
// (Secrets Manager in AWS, .env locally) and never from the repository.
type Config struct {
	AppEnv           Env
	Port             string
	DatabaseURL      string
	RedisURL         string
	KeycloakIssuer   string
	KeycloakAudience string
	// KeycloakURL is Keycloak as the API reaches it, for the JWKS and the admin API. Inside
	// Docker it differs from the issuer host (http://keycloak:8080 vs http://localhost:8081).
	KeycloakURL   string
	KeycloakRealm string
	// EgressURL is the Caddy egress (M14) that adds Fynk's mTLS client certificate to every call
	// to a bank or a market data provider: <EgressURL>/<provider>/... (M5 and M15). It must be
	// https. Empty means no outside provider can be reached, and those calls fail closed.
	EgressURL string
	// EgressCAFile is the PEM file of the CA that signed the egress's own TLS certificate.
	// Empty means the system roots.
	EgressCAFile string
	// KeycloakAdminClientSecret is the client secret of the Keycloak client fynk-admin (client
	// credentials) that M1 uses for the admin API. Optional: when empty, the features that need
	// it answer 503. Never log it.
	KeycloakAdminClientSecret string

	// Bank link (M5). Every one is optional: without them the link endpoints fail closed.
	//
	// BankSignerKeyFile is the PEM RSA private key that signs the private_key_jwt client
	// assertions (PS256) on a developer machine. In AWS an asymmetric KMS key replaces it (M14).
	BankSignerKeyFile string
	// BankFingerprintKeyFile holds the HMAC key, at least 32 bytes, of the refresh token
	// fingerprints kept with each bank link. In AWS a KMS HMAC key replaces it (M14).
	BankFingerprintKeyFile string
	// BankRedirectURI is where a bank sends the authorization code: the app's deep link.
	BankRedirectURI string
	// BancoDemoClientID is Fynk's client at the simulated bank (M16), BancoDemoIssuer the
	// issuer the client assertion is addressed to, and BancoDemoAuthorizeURL the authorization
	// page the phone opens in the system browser.
	BancoDemoClientID     string
	BancoDemoIssuer       string
	BancoDemoAuthorizeURL string
}

// IsLocal reports whether the API runs on a developer machine.
func (c Config) IsLocal() bool { return c.AppEnv == EnvLocal }

// Load reads the configuration through getenv (os.Getenv in production, a map in tests).
// APP_ENV is required, so a missing variable never falls back to local shortcuts.
func Load(getenv func(string) string) (Config, error) {
	c := Config{
		AppEnv:           Env(getenv("APP_ENV")),
		Port:             getenv("PORT"),
		DatabaseURL:      getenv("DATABASE_URL"),
		RedisURL:         getenv("REDIS_URL"),
		KeycloakIssuer:   getenv("KEYCLOAK_ISSUER"),
		KeycloakAudience: getenv("KEYCLOAK_AUDIENCE"),
		KeycloakURL:      getenv("KEYCLOAK_URL"),
		KeycloakRealm:    getenv("KEYCLOAK_REALM"),
		EgressURL:        strings.TrimRight(getenv("EGRESS_URL"), "/"),
		EgressCAFile:     getenv("EGRESS_CA_FILE"),

		KeycloakAdminClientSecret: getenv("FYNK_ADMIN_CLIENT_SECRET"),

		BankSignerKeyFile:      getenv("BANK_SIGNER_KEY_FILE"),
		BankFingerprintKeyFile: getenv("BANK_FINGERPRINT_KEY_FILE"),
		BankRedirectURI:        getenv("BANK_REDIRECT_URI"),
		BancoDemoClientID:      getenv("BANCO_DEMO_CLIENT_ID"),
		BancoDemoIssuer:        getenv("BANCO_DEMO_ISSUER"),
		BancoDemoAuthorizeURL:  getenv("BANCO_DEMO_AUTHORIZE_URL"),
	}
	if c.Port == "" {
		c.Port = "8080"
	}
	if c.KeycloakRealm == "" {
		c.KeycloakRealm = "fynk"
	}
	if c.BankRedirectURI == "" {
		c.BankRedirectURI = "fynk://bank/callback"
	}

	var errs []error
	switch c.AppEnv {
	case EnvLocal, EnvStaging, EnvProd:
	case "":
		errs = append(errs, errors.New("APP_ENV is required (local, staging or prod)"))
	default:
		errs = append(errs, fmt.Errorf("APP_ENV %q is not one of local, staging or prod", c.AppEnv))
	}
	if c.DatabaseURL == "" {
		errs = append(errs, errors.New("DATABASE_URL is required"))
	}
	if c.RedisURL == "" {
		errs = append(errs, errors.New("REDIS_URL is required"))
	}
	// TLS on every hop (CLAUDE.md, Security rules): the egress is never reached in clear.
	if c.EgressURL != "" && !strings.HasPrefix(c.EgressURL, "https://") {
		errs = append(errs, errors.New("EGRESS_URL must start with https://"))
	}
	// The phone opens the bank's authorization page; outside a developer machine it is https.
	if c.BancoDemoAuthorizeURL != "" && c.AppEnv != EnvLocal &&
		!strings.HasPrefix(c.BancoDemoAuthorizeURL, "https://") {
		errs = append(errs, errors.New("BANCO_DEMO_AUTHORIZE_URL must start with https://"))
	}
	return c, errors.Join(errs...)
}
