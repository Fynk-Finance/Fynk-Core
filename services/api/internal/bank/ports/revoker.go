package ports

import (
	"context"
	"sync/atomic"
)

// The Revoker M4 uses is installed once at startup by the bank module, like auth.Install for
// the token verifier: the bank module owns the adapters, and M4 reaches them only through this
// port, so neither module imports the other's internals and internal/app needs no new line.
// Until a revoker is installed (M5 step 2 installs it with the private_key_jwt signer), every
// call fails with ErrProviderUnavailable, and M4's retry job keeps trying.

type revokerBox struct{ r Revoker }

var installed atomic.Pointer[revokerBox]

func init() { installed.Store(&revokerBox{r: unavailable{}}) }

// InstallRevoker sets the revoker used by InstalledRevoker. nil puts the unavailable one back.
func InstallRevoker(r Revoker) {
	if r == nil {
		r = unavailable{}
	}
	installed.Store(&revokerBox{r: r})
}

// InstalledRevoker returns the revoker installed now. Call it at use time, not at startup,
// because modules are built in a fixed order (internal/app).
func InstalledRevoker() Revoker { return installed.Load().r }

type unavailable struct{}

func (unavailable) RevokeConsent(context.Context, string, string) error {
	return ErrProviderUnavailable
}
