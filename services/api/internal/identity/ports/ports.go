// Package ports is the public face of the identity module for other modules (M2).
package ports

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/kcadmin"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/postgres"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/token"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

// Errors the ports return.
var (
	ErrNotFound    = devices.ErrNotFound
	ErrRemoved     = devices.ErrRemoved
	ErrUnavailable = kcadmin.ErrUnavailable
)

// Activator lets M2 activate a device once it approved it (or the recovery code was used).
type Activator interface {
	// ActivateDevice moves a pending device to active. An active device stays active
	// (nil). A removed device returns ErrRemoved and a missing one ErrNotFound.
	//
	// It writes no audit event: M2 records its own device.approved event.
	ActivateDevice(ctx context.Context, deviceID string) error
}

// NewDevices returns the Activator for M2, over identity.devices in pool.
func NewDevices(pool *pgxpool.Pool, clk clock.Clock) Activator {
	return activator{svc: devices.NewService(postgres.New(pool), clk, noAudit{}, nil)}
}

// NewDeviceChecker returns the token.DeviceChecker for the API's token verifier, over
// identity.devices in pool. A removed, foreign or malformed device id is simply not usable.
func NewDeviceChecker(pool *pgxpool.Pool, clk clock.Clock) token.DeviceChecker {
	return devices.NewService(postgres.New(pool), clk, noAudit{}, nil)
}

type activator struct{ svc *devices.Service }

func (a activator) ActivateDevice(ctx context.Context, deviceID string) error {
	return a.svc.Activate(ctx, deviceID)
}

// noAudit is used because activating audits nothing.
type noAudit struct{}

func (noAudit) Record(context.Context, audit.Event) error { return nil }

// DeviceInfo is a device as M2 sees it. It has no session id.
type DeviceInfo struct {
	ID        string
	Name      string
	Platform  string // ios | android
	PublicKey []byte
	Status    string // pending | active
}

// Devices lets M2 read a device and reset the others for the backup reset.
type Devices interface {
	// Get returns the user's device. ErrNotFound for a missing or another user's device,
	// ErrRemoved for a removed one.
	Get(ctx context.Context, userID, deviceID string) (DeviceInfo, error)
	// RemoveOthers removes every device of the user except keepDeviceID and revokes their
	// Keycloak sessions, like POST /devices/sign-out-others but without the active check:
	// M2 calls it only after its own checks, for the backup reset. It records device.removed
	// audit events like the HTTP path. keepDeviceID must exist and not be removed
	// (ErrNotFound, ErrRemoved). Revoking sessions is best effort, as in the HTTP path.
	RemoveOthers(ctx context.Context, userID, keepDeviceID string) error
}

// SessionRevoker ends Keycloak sessions. A nil revoker leaves sessions alone.
type SessionRevoker interface {
	DeleteSession(ctx context.Context, sid string) error
}

// NewSessionRevoker returns the Keycloak admin client as a SessionRevoker, the same one
// the identity module uses for POST /devices/sign-out-others.
func NewSessionRevoker(cfg config.Config) SessionRevoker { return kcadmin.New(cfg, nil) }

// NewDeviceReader returns the Devices port over identity.devices in pool. rec receives the
// device.removed events; revoker may be nil.
func NewDeviceReader(pool *pgxpool.Pool, clk clock.Clock, rec audit.Recorder, revoker SessionRevoker) Devices {
	return deviceReader{svc: devices.NewService(postgres.New(pool), clk, rec, nil), revoker: revoker}
}

type deviceReader struct {
	svc     *devices.Service
	revoker SessionRevoker
}

func (r deviceReader) Get(ctx context.Context, userID, deviceID string) (DeviceInfo, error) {
	d, err := r.svc.Get(ctx, userID, deviceID)
	if err != nil {
		return DeviceInfo{}, err
	}
	return DeviceInfo{
		ID: d.ID, Name: d.Name, Platform: string(d.Platform),
		PublicKey: append([]byte(nil), d.PublicKey...), Status: string(d.Status),
	}, nil
}

func (r deviceReader) RemoveOthers(ctx context.Context, userID, keepDeviceID string) error {
	sids, err := r.svc.RemoveOthersTrusted(ctx, userID, keepDeviceID)
	if err != nil {
		return err
	}
	if r.revoker == nil {
		return nil
	}
	// The devices are already removed: a caller that hangs up must not cancel the revocation.
	ctx = context.WithoutCancel(ctx)
	for _, sid := range sids {
		// Best effort, like the HTTP path. The error is dropped: it may carry ids.
		_ = r.revoker.DeleteSession(ctx, sid)
	}
	return nil
}

// EmailResets lets M2 know when the person last reset the password with the email code, which
// proves they own the mailbox. M2 allows the backup reset ("No tengo ninguno de los dos") only
// shortly after. "Cambiar contraseña" in the app needs only the password and never counts.
type EmailResets interface {
	// EmailResetAt returns the time of the last reset by email code. The bool is false when the
	// person never did one. ErrNotFound when the user does not exist in Keycloak.
	EmailResetAt(ctx context.Context, userID string) (time.Time, bool, error)
}

// NewEmailResets returns the EmailResets port over the Keycloak admin client.
func NewEmailResets(cfg config.Config) EmailResets { return emailResets{kc: kcadmin.New(cfg, nil)} }

type emailResets struct{ kc *kcadmin.Client }

func (r emailResets) EmailResetAt(ctx context.Context, userID string) (time.Time, bool, error) {
	at, ok, err := r.kc.EmailResetAt(ctx, userID)
	if errors.Is(err, kcadmin.ErrNotFound) {
		return time.Time{}, false, ErrNotFound
	}
	return at, ok, err
}

// Sessions lets M2 know when a Keycloak session started. The backup reset needs the caller's
// session to be newer than the email-code reset, so an older stolen session cannot use it.
type Sessions interface {
	// SessionStart returns the start time of the user's session sid. The bool is false when
	// the user has no such session. ErrNotFound when the user does not exist in Keycloak.
	SessionStart(ctx context.Context, userID, sid string) (time.Time, bool, error)
}

// NewSessions returns the Sessions port over the Keycloak admin client.
func NewSessions(cfg config.Config) Sessions { return sessions{kc: kcadmin.New(cfg, nil)} }

type sessions struct{ kc *kcadmin.Client }

func (s sessions) SessionStart(ctx context.Context, userID, sid string) (time.Time, bool, error) {
	at, ok, err := s.kc.SessionStart(ctx, userID, sid)
	if errors.Is(err, kcadmin.ErrNotFound) {
		return time.Time{}, false, ErrNotFound
	}
	return at, ok, err
}

// UserProfile is the profile details from Keycloak.
type UserProfile struct {
	ID            string
	Email         string
	FirstName     string
	LastName      string
	EmailVerified bool
	CreatedAt     time.Time
}

// UserProfileReader reads user profiles from Keycloak.
type UserProfileReader interface {
	GetUser(ctx context.Context, userID string) (UserProfile, error)
}

// NewUserProfileReader returns a UserProfileReader backed by kcadmin.Client.
func NewUserProfileReader(cfg config.Config) UserProfileReader {
	return userProfileReader{kc: kcadmin.New(cfg, nil)}
}

type userProfileReader struct{ kc *kcadmin.Client }

func (r userProfileReader) GetUser(ctx context.Context, userID string) (UserProfile, error) {
	u, err := r.kc.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, kcadmin.ErrNotFound) {
			return UserProfile{}, ErrNotFound
		}
		if errors.Is(err, kcadmin.ErrUnavailable) {
			return UserProfile{}, ErrUnavailable
		}
		return UserProfile{}, err
	}
	return UserProfile{
		ID:            userID,
		Email:         u.Email,
		FirstName:     u.FirstName,
		LastName:      u.LastName,
		EmailVerified: u.EmailVerified,
		CreatedAt:     u.CreatedAt,
	}, nil
}
