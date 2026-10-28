package main

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

var quiet = slog.New(slog.NewTextHandler(io.Discard, nil))

func keycloakConfig(env config.Env) config.Config {
	return config.Config{
		AppEnv: env, KeycloakIssuer: "http://localhost:8081/realms/fynk", KeycloakAudience: "fynk-api",
		KeycloakURL: "http://keycloak:8080", KeycloakRealm: "fynk",
	}
}

func TestVerifierAcceptsDevTokenOnlyInLocal(t *testing.T) {
	local, err := newVerifier(keycloakConfig(config.EnvLocal), quiet)
	if err != nil {
		t.Fatal(err)
	}
	if u, err := local.Verify(context.Background(), auth.DevToken, ""); err != nil || u.ID != "dev-user" {
		t.Fatalf("local dev-token: %+v, %v", u, err)
	}
	for _, env := range []config.Env{config.EnvStaging, config.EnvProd} {
		v, err := newVerifier(keycloakConfig(env), quiet)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := v.Verify(context.Background(), auth.DevToken, ""); err == nil {
			t.Fatalf("%s accepted dev-token", env)
		}
	}
}

// Without Keycloak settings only a local API starts, on dev-token alone.
func TestVerifierNeedsKeycloakOutsideLocal(t *testing.T) {
	for _, env := range []config.Env{config.EnvStaging, config.EnvProd} {
		cfg := keycloakConfig(env)
		cfg.KeycloakURL = ""
		if _, err := newVerifier(cfg, quiet); err == nil {
			t.Fatalf("%s started without KEYCLOAK_URL", env)
		}
		cfg = keycloakConfig(env)
		cfg.KeycloakIssuer = ""
		if _, err := newVerifier(cfg, quiet); err == nil {
			t.Fatalf("%s started without KEYCLOAK_ISSUER", env)
		}
	}
	v, err := newVerifier(config.Config{AppEnv: config.EnvLocal}, quiet)
	if err != nil {
		t.Fatal(err)
	}
	if u, err := v.Verify(context.Background(), auth.DevToken, ""); err != nil || u.ID != "dev-user" {
		t.Fatalf("local without Keycloak: %+v, %v", u, err)
	}
}
