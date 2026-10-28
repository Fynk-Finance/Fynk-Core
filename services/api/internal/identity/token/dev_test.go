package token

import (
	"context"
	"testing"

	"github.com/golang-jwt/jwt/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

// Team decision: with APP_ENV=local the API keeps accepting M0's dev-token next to real
// Keycloak tokens. Staging and prod only accept Keycloak tokens.
func TestDevTokenIsAcceptedOnlyInLocal(t *testing.T) {
	a, _, _ := testKeys(t)
	f := newFixture(t, psKey(t, "a", a))
	kcToken := sign(t, jwt.SigningMethodPS256, a, "a", accessClaims())

	local := WithLocalDevToken(f.v, config.EnvLocal)
	if u, err := local.Verify(context.Background(), auth.DevToken, "device-1"); err != nil || u.ID != "dev-user" {
		t.Fatalf("local dev-token: %+v, %v", u, err)
	}
	if u, err := local.Verify(context.Background(), kcToken, ""); err != nil || u.ID != "user-1" {
		t.Fatalf("local Keycloak token: %+v, %v", u, err)
	}

	for _, env := range []config.Env{config.EnvStaging, config.EnvProd, ""} {
		v := WithLocalDevToken(f.v, env)
		mustReject(t, v, auth.DevToken)
		if _, err := v.Verify(context.Background(), kcToken, ""); err != nil {
			t.Fatalf("%q: Keycloak token rejected: %v", env, err)
		}
	}
}
