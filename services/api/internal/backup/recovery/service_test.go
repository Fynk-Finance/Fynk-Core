package recovery_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/recovery"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var now = time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)

type fakeRepo struct {
	key  *recovery.Key
	puts int
}

func (f *fakeRepo) Put(_ context.Context, _ string, k recovery.Key) error {
	f.key, f.puts = &k, f.puts+1
	return nil
}
func (f *fakeRepo) Get(context.Context, string) (recovery.Key, error) {
	if f.key == nil {
		return recovery.Key{}, recovery.ErrNoKey
	}
	return *f.key, nil
}

type fakeDevices struct {
	status string
	err    error
}

func (f *fakeDevices) Get(context.Context, string, string) (identity.DeviceInfo, error) {
	return identity.DeviceInfo{Status: f.status}, f.err
}
func (*fakeDevices) RemoveOthers(context.Context, string, string) error { return nil }

type fakeActivator struct {
	activated []string
	err       error
}

func (f *fakeActivator) ActivateDevice(_ context.Context, id string) error {
	f.activated = append(f.activated, id)
	return f.err
}

type fakeAudit struct{ events []audit.Event }

func (f *fakeAudit) Record(_ context.Context, e audit.Event) error {
	f.events = append(f.events, e)
	return nil
}

type env struct {
	svc  *recovery.Service
	repo *fakeRepo
	devs *fakeDevices
	act  *fakeActivator
	aud  *fakeAudit
}

var user = auth.User{ID: "u1", DeviceID: "d1"}

var proof = bytes.Repeat([]byte{7}, 32)

func newEnv(status string) env {
	e := env{repo: &fakeRepo{}, devs: &fakeDevices{status: status}, act: &fakeActivator{}, aud: &fakeAudit{}}
	clk := clock.NewFixed(now)
	e.svc = recovery.NewService(e.repo, e.devs, e.act, recovery.NewMemoryLimiter(clk), clk, e.aud)
	return e
}

func withKey(e env) env {
	h := sha256.Sum256(proof)
	e.repo.key = &recovery.Key{WrappedDEK: []byte("w"), ProofHash: h[:], KDF: recovery.KDF}
	return e
}

func TestSetOnlyActiveDeviceAndAudits(t *testing.T) {
	e := newEnv("active")
	if err := e.svc.Set(context.Background(), user, recovery.Key{KDF: recovery.KDF, ProofHash: proof}); err != nil {
		t.Fatal(err)
	}
	if e.repo.puts != 1 || !e.repo.key.CreatedAt.Equal(now) {
		t.Fatalf("not stored with the clock: %+v", e.repo.key)
	}
	if len(e.aud.events) != 1 || e.aud.events[0].Type != audit.RecoveryKeySet || e.aud.events[0].Meta["kdf"] != "argon2id" {
		t.Fatalf("audit %+v", e.aud.events)
	}
	for name, c := range map[string]struct {
		e env
		u auth.User
	}{
		"pending":   {newEnv("pending"), user},
		"no device": {newEnv("active"), auth.User{ID: "u1"}},
		"not found": {env{repo: &fakeRepo{}, devs: &fakeDevices{err: identity.ErrNotFound}, aud: &fakeAudit{}}, user},
	} {
		if c.e.svc == nil {
			clk := clock.NewFixed(now)
			c.e.svc = recovery.NewService(c.e.repo, c.e.devs, nil, recovery.NewMemoryLimiter(clk), clk, c.e.aud)
		}
		if err := c.e.svc.Set(context.Background(), c.u, recovery.Key{}); !errors.Is(err, recovery.ErrNotActive) {
			t.Fatalf("%s: %v", name, err)
		}
		if c.e.repo.puts != 0 {
			t.Fatalf("%s stored a key", name)
		}
	}
}

func TestGetHidesTheProofHash(t *testing.T) {
	e := withKey(newEnv("pending"))
	k, err := e.svc.Get(context.Background(), user)
	if err != nil || k.ProofHash != nil || string(k.WrappedDEK) != "w" {
		t.Fatalf("%+v, %v", k, err)
	}
	if e.repo.key.ProofHash == nil {
		t.Fatal("Get cleared the stored hash")
	}
	if _, err := e.svc.Get(context.Background(), auth.User{ID: "u1"}); !errors.Is(err, recovery.ErrNotActive) {
		t.Fatalf("no device: %v", err)
	}
	if _, err := newEnv("active").svc.Get(context.Background(), user); !errors.Is(err, recovery.ErrNoKey) {
		t.Fatalf("no key: %v", err)
	}
}

func TestActivateMatchActivatesAndAudits(t *testing.T) {
	e := withKey(newEnv("pending"))
	if err := e.svc.Activate(context.Background(), user, proof); err != nil {
		t.Fatal(err)
	}
	if len(e.act.activated) != 1 || e.act.activated[0] != "d1" {
		t.Fatalf("activated %v", e.act.activated)
	}
	if len(e.aud.events) != 2 || e.aud.events[0].Type != audit.DeviceApproved || e.aud.events[1].Type != audit.BackupRestored ||
		e.aud.events[0].Meta["method"] != "recovery_code" || e.aud.events[1].Meta["method"] != "recovery_code" {
		t.Fatalf("audit %+v", e.aud.events)
	}
}

func TestActivateMismatchCountsAndBlocksOnTheSixth(t *testing.T) {
	e := withKey(newEnv("pending"))
	wrong := bytes.Repeat([]byte{9}, 32)
	for i := 0; i < recovery.MaxFailures; i++ {
		if err := e.svc.Activate(context.Background(), user, wrong); !errors.Is(err, recovery.ErrMismatch) {
			t.Fatalf("attempt %d: %v", i+1, err)
		}
	}
	// Even the right proof is refused once the limit is reached, before comparing.
	if err := e.svc.Activate(context.Background(), user, proof); !errors.Is(err, recovery.ErrTooMany) {
		t.Fatalf("sixth: %v", err)
	}
	if len(e.act.activated) != 0 || len(e.aud.events) != 0 {
		t.Fatal("a blocked attempt changed something")
	}
}

func TestMemoryLimiterRollsOverAfterAnHour(t *testing.T) {
	clk := clock.NewFixed(now)
	l := recovery.NewMemoryLimiter(clk)
	ctx := context.Background()
	for i := 0; i < recovery.MaxFailures; i++ {
		_ = l.Fail(ctx, "u1")
	}
	if b, _ := l.Blocked(ctx, "u1"); !b {
		t.Fatal("not blocked")
	}
	if b, _ := l.Blocked(ctx, "u2"); b {
		t.Fatal("another user blocked")
	}
	clk.Advance(time.Hour + time.Second)
	if b, _ := l.Blocked(ctx, "u1"); b {
		t.Fatal("still blocked after an hour")
	}
}

func TestActivateOtherOutcomes(t *testing.T) {
	ctx := context.Background()
	// Already active: 204 without audit or activation, even without a key.
	e := newEnv("active")
	if err := e.svc.Activate(ctx, user, proof); err != nil || len(e.aud.events) != 0 || len(e.act.activated) != 0 {
		t.Fatalf("active: %v %+v", err, e.aud.events)
	}
	// Removed device.
	e = newEnv("pending")
	e.devs.err = identity.ErrRemoved
	if err := e.svc.Activate(ctx, user, proof); !errors.Is(err, recovery.ErrRemoved) {
		t.Fatalf("removed: %v", err)
	}
	// Removed between the check and the activation.
	e = withKey(newEnv("pending"))
	e.act.err = identity.ErrRemoved
	if err := e.svc.Activate(ctx, user, proof); !errors.Is(err, recovery.ErrRemoved) || len(e.aud.events) != 0 {
		t.Fatalf("removed late: %v", err)
	}
	// No key.
	if err := newEnv("pending").svc.Activate(ctx, user, proof); !errors.Is(err, recovery.ErrNoKey) {
		t.Fatalf("no key: %v", err)
	}
	// No device id.
	if err := newEnv("pending").svc.Activate(ctx, auth.User{ID: "u1"}, proof); !errors.Is(err, recovery.ErrNotActive) {
		t.Fatalf("no device: %v", err)
	}
}
