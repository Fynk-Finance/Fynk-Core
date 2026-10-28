// Package token checks Keycloak access tokens for the API (shared contracts, section 4.2):
// PS256 only, keys from the realm's JWKS cached 10 minutes, and iss, aud, exp, nbf and iat
// checked with 30 s of clock skew. cmd/api installs it with auth.Install, so every module
// keeps using auth.Require and auth.UserFrom from internal/platform/auth.
package token

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// leeway is the clock skew allowed between Keycloak and the API.
const leeway = 30 * time.Second

// DeviceChecker tells whether a device is registered to the user and may act for it.
// The identity module implements it on identity.devices.
type DeviceChecker interface {
	Usable(ctx context.Context, userID, deviceID string) (bool, error)
}

// Config is what the verifier needs.
type Config struct {
	Issuer   string // KEYCLOAK_ISSUER, e.g. http://localhost:8081/realms/fynk
	Audience string // KEYCLOAK_AUDIENCE, fynk-api
	// JWKSURL is where the API reaches the realm's keys. Inside Docker this is not the
	// issuer's host (see JWKSURL).
	JWKSURL    string
	HTTPClient *http.Client  // nil: a client with a 5 s timeout
	Clock      clock.Clock   // nil: clock.System
	Log        *slog.Logger  // nil: slog.Default
	Devices    DeviceChecker // nil: X-Device-Id is never trusted and User.DeviceID stays empty
}

// JWKSURL returns the JWKS endpoint of realm on a Keycloak reached at keycloakURL.
func JWKSURL(keycloakURL, realm string) string {
	return strings.TrimRight(keycloakURL, "/") + "/realms/" + realm + "/protocol/openid-connect/certs"
}

// Verifier implements auth.Verifier for Keycloak access tokens.
type Verifier struct {
	cfg    Config
	keys   *keySet
	parser *jwt.Parser
}

// New returns a verifier. Keys are fetched on the first request, not here, so the API starts
// even while Keycloak is still starting.
func New(cfg Config) (*Verifier, error) {
	if cfg.Issuer == "" || cfg.Audience == "" {
		return nil, errors.New("token: issuer and audience are required")
	}
	if u, err := url.Parse(cfg.JWKSURL); err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return nil, errors.New("token: JWKS URL must be an absolute http(s) URL")
	}
	if cfg.HTTPClient == nil {
		cfg.HTTPClient = &http.Client{Timeout: fetchTimeout}
	}
	if cfg.Clock == nil {
		cfg.Clock = clock.System{}
	}
	if cfg.Log == nil {
		cfg.Log = slog.Default()
	}
	return &Verifier{
		cfg:  cfg,
		keys: &keySet{url: cfg.JWKSURL, client: cfg.HTTPClient, clock: cfg.Clock, log: cfg.Log},
		parser: jwt.NewParser(
			jwt.WithValidMethods([]string{"PS256"}),
			jwt.WithIssuer(cfg.Issuer),
			jwt.WithAudience(cfg.Audience),
			jwt.WithExpirationRequired(),
			jwt.WithIssuedAt(),
			jwt.WithLeeway(leeway),
			jwt.WithTimeFunc(cfg.Clock.Now),
		),
	}, nil
}

// claims are the parts of a Keycloak access token the API reads.
type claims struct {
	jwt.RegisteredClaims
	Type          string `json:"typ"` // "Bearer" for access tokens, "ID" and "Refresh" for the others
	EmailVerified bool   `json:"email_verified"`
	SessionID     string `json:"sid"` // optional
}

// Verify implements auth.Verifier. Every rejection wraps auth.ErrInvalidToken; the token
// itself never reaches an error or a log line.
func (v *Verifier) Verify(ctx context.Context, accessToken, deviceID string) (auth.User, error) {
	var c claims
	_, err := v.parser.ParseWithClaims(accessToken, &c, func(t *jwt.Token) (any, error) {
		kid, _ := t.Header["kid"].(string)
		if kid == "" {
			return nil, errors.New("token has no kid")
		}
		return v.keys.key(ctx, kid)
	})
	if err != nil {
		return auth.User{}, fmt.Errorf("%w: %w", auth.ErrInvalidToken, err)
	}
	if c.Type != "Bearer" || c.Subject == "" {
		return auth.User{}, fmt.Errorf("%w: not an access token", auth.ErrInvalidToken)
	}

	u := auth.User{ID: c.Subject, EmailVerified: c.EmailVerified, SessionID: c.SessionID}
	if deviceID != "" && v.cfg.Devices != nil {
		// The token is valid even when the device can't be checked. Failing here would answer
		// 401 and sign the person out over a database error, so the device is just not trusted.
		ok, err := v.cfg.Devices.Usable(ctx, u.ID, deviceID)
		if err != nil {
			v.cfg.Log.WarnContext(ctx, "identity: could not check the device, it is not trusted")
		}
		if err == nil && ok {
			u.DeviceID = deviceID
		}
	}
	return u, nil
}
