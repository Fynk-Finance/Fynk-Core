// Package auth protects API routes (shared contracts, section 4.2).
//
// Modules wrap their routes with Require and read the caller with UserFrom. How a token is
// checked is decided by the Verifier installed once at startup by internal/app:
//   - until M1 lands, DevVerifier accepts the token "dev-token" only when APP_ENV=local;
//   - M1 provides the Keycloak verifier (PS256, cached JWKS, iss and aud checked) and
//     internal/app installs it, so M1 never edits this package.
package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync/atomic"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// DeviceHeader carries the id of the calling device.
const DeviceHeader = "X-Device-Id"

// DevToken is the only token DevVerifier accepts, and only in local.
const DevToken = "dev-token"

// User is the authenticated caller.
type User struct {
	ID            string // Keycloak sub
	EmailVerified bool
	DeviceID      string // from X-Device-Id, checked against identity.devices by M1
	SessionID     string // Keycloak sid claim; M1 revokes it when the device is removed
}

// Verifier checks an access token and returns its user.
type Verifier interface {
	Verify(ctx context.Context, accessToken, deviceID string) (User, error)
}

// ErrInvalidToken is returned by verifiers for any token they do not accept.
var ErrInvalidToken = errors.New("invalid access token")

type box struct{ v Verifier }

// Fails closed: until Install is called, every request is rejected.
var current atomic.Pointer[box]

func init() { current.Store(&box{v: denyAll{}}) }

// Install sets the verifier used by Require. internal/app calls it once at startup.
func Install(v Verifier) {
	if v == nil {
		v = denyAll{}
	}
	current.Store(&box{v: v})
}

type ctxKey struct{}

// Require rejects requests without a valid bearer token with 401 problem JSON,
// and stores the User in the request context for UserFrom.
func Require(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := bearer(r.Header.Get("Authorization"))
		if !ok {
			problem.Unauthorized(w, r)
			return
		}
		u, err := current.Load().v.Verify(r.Context(), token, r.Header.Get(DeviceHeader))
		if err != nil {
			problem.Unauthorized(w, r)
			return
		}
		next.ServeHTTP(w, r.WithContext(WithUser(r.Context(), u)))
	})
}

// UserFrom returns the user stored by Require.
func UserFrom(ctx context.Context) (User, bool) {
	u, ok := ctx.Value(ctxKey{}).(User)
	return u, ok
}

// WithUser stores u in ctx. Used by Require and by tests.
func WithUser(ctx context.Context, u User) context.Context {
	return context.WithValue(ctx, ctxKey{}, u)
}

func bearer(header string) (string, bool) {
	scheme, token, found := strings.Cut(header, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}
	token = strings.TrimSpace(token)
	return token, token != ""
}

type denyAll struct{}

func (denyAll) Verify(context.Context, string, string) (User, error) { return User{}, ErrInvalidToken }

// DevVerifier is M0's stub: it accepts DevToken only when the API runs with APP_ENV=local.
type DevVerifier struct {
	Env config.Env
}

// Verify implements Verifier.
func (d DevVerifier) Verify(_ context.Context, accessToken, deviceID string) (User, error) {
	if d.Env != config.EnvLocal || accessToken != DevToken {
		return User{}, ErrInvalidToken
	}
	return User{ID: "dev-user", EmailVerified: true, DeviceID: deviceID}, nil
}
