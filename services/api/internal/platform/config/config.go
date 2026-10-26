// Package config reads the API settings from environment variables.
package config

import (
	"errors"
	"fmt"
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
	}
	if c.Port == "" {
		c.Port = "8080"
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
	return c, errors.Join(errs...)
}
