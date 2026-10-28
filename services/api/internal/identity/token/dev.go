package token

import (
	"context"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

// WithLocalDevToken also accepts M0's dev-token when the API runs with APP_ENV=local, so other
// modules can keep calling the local API without Keycloak (team decision). In staging and prod
// it returns v unchanged.
func WithLocalDevToken(v auth.Verifier, env config.Env) auth.Verifier {
	if env != config.EnvLocal {
		return v
	}
	return localDev{next: v, dev: auth.DevVerifier{Env: env}}
}

type localDev struct {
	next auth.Verifier
	dev  auth.DevVerifier
}

func (l localDev) Verify(ctx context.Context, accessToken, deviceID string) (auth.User, error) {
	if accessToken == auth.DevToken {
		return l.dev.Verify(ctx, accessToken, deviceID)
	}
	return l.next.Verify(ctx, accessToken, deviceID)
}
