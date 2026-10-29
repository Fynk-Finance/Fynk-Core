package main

import (
	"errors"
	"log/slog"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/token"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

// newVerifier returns M1's Keycloak verifier (PS256, cached JWKS). With APP_ENV=local it also
// accepts dev-token, and a local API without Keycloak settings runs on dev-token alone.
// devices decides which X-Device-Id values the verifier trusts.
func newVerifier(cfg config.Config, log *slog.Logger, devices token.DeviceChecker) (auth.Verifier, error) {
	if cfg.KeycloakURL == "" {
		if !cfg.IsLocal() {
			return nil, errors.New("KEYCLOAK_URL is required outside local")
		}
		log.Warn("KEYCLOAK_URL is not set: the API accepts only dev-token")
		return auth.DevVerifier{Env: cfg.AppEnv}, nil
	}
	v, err := token.New(token.Config{
		Issuer:   cfg.KeycloakIssuer,
		Audience: cfg.KeycloakAudience,
		JWKSURL:  token.JWKSURL(cfg.KeycloakURL, cfg.KeycloakRealm),
		Log:      log,
		Devices:  devices,
	})
	if err != nil {
		return nil, err
	}
	return token.WithLocalDevToken(v, cfg.AppEnv), nil
}
