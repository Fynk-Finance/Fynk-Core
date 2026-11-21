package ports

import (
	"context"
	"fmt"
	"sync/atomic"
)

// ErrDemoProvisioningDisabled: the bank simulator is not configured (production, or a stack
// without it). It wraps ErrProviderUnavailable so GET /bank/simulated-entities answers 503
// provider_unavailable, and the sign-up hook (M1) can skip it without logging.
var ErrDemoProvisioningDisabled = fmt.Errorf("demo provisioning is not configured: %w", ErrProviderUnavailable)

// DemoProvisioner asks the bank simulator to create the demo accounts of a user (ADR 0008,
// demo only). It sends the simulator only sub, the opaque Keycloak id, and returns the provider
// ids of the entities where the user has accounts. The call is idempotent. Nothing is stored.
type DemoProvisioner interface {
	Provision(ctx context.Context, sub string) ([]string, error)
}

// The provisioner is installed once at startup by the bank module, like the Revoker: M1 calls
// it at sign-up and M5's endpoint calls it from the app, with no import of the bank internals.

type provisionerBox struct{ p DemoProvisioner }

var provisioner atomic.Pointer[provisionerBox]

func init() { provisioner.Store(&provisionerBox{p: disabled{}}) }

// InstallDemoProvisioner sets the provisioner used by InstalledDemoProvisioner. nil puts the
// disabled one back.
func InstallDemoProvisioner(p DemoProvisioner) {
	if p == nil {
		p = disabled{}
	}
	provisioner.Store(&provisionerBox{p: p})
}

// InstalledDemoProvisioner returns the provisioner installed now. Call it at use time, not at
// startup, because modules are built in a fixed order (internal/app).
func InstalledDemoProvisioner() DemoProvisioner { return provisioner.Load().p }

type disabled struct{}

func (disabled) Provision(context.Context, string) ([]string, error) {
	return nil, ErrDemoProvisioningDisabled
}
