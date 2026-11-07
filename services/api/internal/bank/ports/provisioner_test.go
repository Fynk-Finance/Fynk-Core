package ports

import (
	"context"
	"errors"
	"testing"
)

type fakeProvisioner struct{ ids []string }

func (f fakeProvisioner) Provision(context.Context, string) ([]string, error) { return f.ids, nil }

func TestProvisioningIsDisabledUntilInstalled(t *testing.T) {
	InstallDemoProvisioner(nil)
	_, err := InstalledDemoProvisioner().Provision(context.Background(), "sub")
	if !errors.Is(err, ErrDemoProvisioningDisabled) || !errors.Is(err, ErrProviderUnavailable) {
		t.Fatalf("got %v, want disabled wrapping provider_unavailable", err)
	}
}

func TestInstalledProvisionerIsUsedAndNilRestoresTheDefault(t *testing.T) {
	t.Cleanup(func() { InstallDemoProvisioner(nil) })
	InstallDemoProvisioner(fakeProvisioner{ids: []string{"banco-demo"}})
	ids, err := InstalledDemoProvisioner().Provision(context.Background(), "sub")
	if err != nil || len(ids) != 1 || ids[0] != "banco-demo" {
		t.Fatalf("got %v, %v", ids, err)
	}
	InstallDemoProvisioner(nil)
	if _, err := InstalledDemoProvisioner().Provision(context.Background(), "sub"); !errors.Is(err, ErrDemoProvisioningDisabled) {
		t.Fatalf("got %v", err)
	}
}
