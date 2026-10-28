// Package ports is the public face of the identity module for other modules (M2).
package ports

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/postgres"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/token"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// Errors ActivateDevice returns.
var (
	ErrNotFound = devices.ErrNotFound
	ErrRemoved  = devices.ErrRemoved
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
