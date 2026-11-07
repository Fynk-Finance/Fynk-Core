package devices_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"testing"
	"time"

	bankports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

const secretSub = "sub-secret-9c1d"

type fakeProvisioner struct {
	subs []string
	err  error
	// block makes the call wait for the context, like a simulator that does not answer.
	block bool
}

func (f *fakeProvisioner) Provision(ctx context.Context, sub string) ([]string, error) {
	f.subs = append(f.subs, sub)
	if f.block {
		<-ctx.Done()
		return nil, ctx.Err()
	}
	return []string{"banco-demo"}, f.err
}

// demoEnv installs p as the demo provisioner (restoring the previous one) and returns a service
// whose log is captured.
func demoEnv(t *testing.T, p bankports.DemoProvisioner) (env, *bytes.Buffer) {
	t.Helper()
	prev := bankports.InstalledDemoProvisioner()
	bankports.InstallDemoProvisioner(p)
	t.Cleanup(func() { bankports.InstallDemoProvisioner(prev) })
	logs := &bytes.Buffer{}
	n := 0
	clk := clock.NewFixed(t0)
	rec := &recorder{}
	svc := devices.NewService(newFakeRepo(), clk, rec, func() string { n++; return fmt.Sprintf("dev-%d", n) }).
		WithLog(slog.New(slog.NewTextHandler(logs, nil)))
	return env{svc, clk, rec}, logs
}

// HU-058: the first device asks the simulator for the demo accounts, once, with the Keycloak sub.
func TestFirstDeviceProvisionsTheDemoAccountsOnce(t *testing.T) {
	p := &fakeProvisioner{}
	e, _ := demoEnv(t, p)
	mustRegister(t, e, user(secretSub), 1)
	if len(p.subs) != 1 || p.subs[0] != secretSub {
		t.Fatalf("provisioner calls = %v, want one with the user's sub", p.subs)
	}
}

func TestASecondPendingDeviceDoesNotProvision(t *testing.T) {
	p := &fakeProvisioner{}
	e, _ := demoEnv(t, p)
	mustRegister(t, e, user("u1"), 1)
	second := mustRegister(t, e, user("u1"), 2)
	if second.Status != devices.StatusPending || len(p.subs) != 1 {
		t.Fatalf("status %s, provisioner calls %d, want pending and 1", second.Status, len(p.subs))
	}
}

func TestARepeatedRegistrationDoesNotProvisionAgain(t *testing.T) {
	p := &fakeProvisioner{}
	e, _ := demoEnv(t, p)
	u := user("u1")
	if _, _, err := e.svc.Register(context.Background(), u, in(1), "key-1"); err != nil {
		t.Fatal(err)
	}
	if _, created, err := e.svc.Register(context.Background(), u, in(1), "key-1"); err != nil || created {
		t.Fatalf("replay: created=%v err=%v", created, err)
	}
	if len(p.subs) != 1 {
		t.Fatalf("provisioner calls = %d, want 1", len(p.subs))
	}
}

// A failing simulator never fails the registration, and the log holds no sub.
func TestAProvisionerErrorStillRegistersTheDevice(t *testing.T) {
	for name, err := range map[string]error{
		"unavailable": fmt.Errorf("bank: %w", bankports.ErrProviderUnavailable),
		"other":       errors.New("connection to " + secretSub + " failed"),
	} {
		e, logs := demoEnv(t, &fakeProvisioner{err: err})
		d := mustRegister(t, e, user(secretSub), 1)
		if d.Status != devices.StatusActive {
			t.Errorf("%s: status %s", name, d.Status)
		}
		if logs.Len() == 0 {
			t.Errorf("%s: the failure was not logged", name)
		}
		if strings.Contains(logs.String(), secretSub) {
			t.Errorf("%s: the sub reached the log: %s", name, logs)
		}
	}
}

func TestASimulatorThatDoesNotAnswerTimesOutAndStillRegisters(t *testing.T) {
	e, logs := demoEnv(t, &fakeProvisioner{block: true})
	start := time.Now()
	d := mustRegister(t, e, user(secretSub), 1)
	if d.Status != devices.StatusActive {
		t.Fatalf("status %s", d.Status)
	}
	if took := time.Since(start); took < time.Second || took > 4*time.Second {
		t.Fatalf("took %v, want about 2 s", took)
	}
	if !strings.Contains(logs.String(), "timeout") || strings.Contains(logs.String(), secretSub) {
		t.Fatalf("log: %s", logs)
	}
}

// Without a simulator (production) sign-up neither fails nor logs anything.
func TestADisabledSimulatorIsSkippedSilently(t *testing.T) {
	e, logs := demoEnv(t, nil)
	mustRegister(t, e, user("u1"), 1)
	if logs.Len() != 0 {
		t.Fatalf("log: %s", logs)
	}
}
