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
	}
	if c.Port == "" {
		c.Port = "8080"
	}
	if c.KeycloakRealm == "" {
		c.KeycloakRealm = "fynk"
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
	return c, errors.Join(errs...)
}
