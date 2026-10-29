package devices_test

import (
	"context"
	"errors"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
)

// threeDevices registers an active device a and two pending ones, b and c.
func threeDevices(t *testing.T, e env) (a, b, c devices.Device) {
	t.Helper()
	a = mustRegister(t, e, user("u1"), 1)
	b = mustRegister(t, e, auth.User{ID: "u1", SessionID: "sid-b"}, 2)
	c = mustRegister(t, e, auth.User{ID: "u1", SessionID: "sid-c"}, 3)
	if a.Status != devices.StatusActive || b.Status != devices.StatusPending {
		t.Fatalf("setup statuses: %s %s", a.Status, b.Status)
	}
	return a, b, c
}

func TestPendingCallerCannotRemoveAnotherDevice(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a, b, c := threeDevices(t, e)
	for _, target := range []string{a.ID, c.ID} {
		if _, err := e.svc.Remove(ctx, "u1", b.ID, target); !errors.Is(err, devices.ErrNotActive) {
			t.Fatalf("pending removing %s: %v", target, err)
		}
	}
	if list, _ := e.svc.List(ctx, "u1"); len(list) != 3 {
		t.Fatalf("a device was removed: %v", list)
	}
	if len(e.rec.events) != 3 { // only the three registrations
		t.Fatalf("unexpected audit events: %d", len(e.rec.events))
	}
}

func TestPendingCallerCanRemoveItself(t *testing.T) {
	e := setup()
	_, b, _ := threeDevices(t, e)
	sid, err := e.svc.Remove(context.Background(), "u1", b.ID, b.ID)
	if err != nil || sid != "sid-b" {
		t.Fatalf("sid %q err %v", sid, err)
	}
}

func TestActiveCallerCanRemoveAnotherDevice(t *testing.T) {
	e := setup()
	a, b, _ := threeDevices(t, e)
	if sid, err := e.svc.Remove(context.Background(), "u1", a.ID, b.ID); err != nil || sid != "sid-b" {
		t.Fatalf("sid %q err %v", sid, err)
	}
}

func TestBlankOrUnknownCallerCannotRemoveAnotherDevice(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a, b, _ := threeDevices(t, e)
	for _, caller := range []string{"", "missing"} {
		if _, err := e.svc.Remove(ctx, "u1", caller, b.ID); !errors.Is(err, devices.ErrNotActive) {
			t.Fatalf("caller %q: %v", caller, err)
		}
	}
	// A removed caller is not active either.
	if _, err := e.svc.Remove(ctx, "u1", a.ID, a.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Remove(ctx, "u1", a.ID, b.ID); !errors.Is(err, devices.ErrNotActive) {
		t.Fatalf("removed caller: %v", err)
	}
}

func TestRemoveOthersNeedsAnActiveCaller(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a, b, _ := threeDevices(t, e)
	if _, err := e.svc.RemoveOthers(ctx, "u1", b.ID); !errors.Is(err, devices.ErrNotActive) {
		t.Fatalf("pending: %v", err)
	}
	if _, err := e.svc.RemoveOthers(ctx, "u1", ""); !errors.Is(err, devices.ErrNotActive) {
		t.Fatalf("blank: %v", err)
	}
	if list, _ := e.svc.List(ctx, "u1"); len(list) != 3 {
		t.Fatalf("a device was removed: %v", list)
	}
	if sids, err := e.svc.RemoveOthers(ctx, "u1", a.ID); err != nil || len(sids) != 2 {
		t.Fatalf("active: %v %v", sids, err)
	}
}

func TestRemoveOthersTrustedSkipsTheActiveCheck(t *testing.T) {
	e := setup()
	ctx := context.Background()
	_, b, _ := threeDevices(t, e)
	sids, err := e.svc.RemoveOthersTrusted(ctx, "u1", b.ID)
	if err != nil || len(sids) != 2 {
		t.Fatalf("sids %v err %v", sids, err)
	}
	if list, _ := e.svc.List(ctx, "u1"); len(list) != 1 || list[0].ID != b.ID {
		t.Fatalf("list = %v", list)
	}
	if _, err := e.svc.RemoveOthersTrusted(ctx, "u1", "missing"); !errors.Is(err, devices.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
}

func TestGet(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a, b, _ := threeDevices(t, e)
	if d, err := e.svc.Get(ctx, "u1", b.ID); err != nil || d.Status != devices.StatusPending {
		t.Fatalf("get: %v %v", d, err)
	}
	if _, err := e.svc.Get(ctx, "u2", a.ID); !errors.Is(err, devices.ErrNotFound) {
		t.Fatalf("foreign: %v", err)
	}
	if _, err := e.svc.Remove(ctx, "u1", a.ID, b.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Get(ctx, "u1", b.ID); !errors.Is(err, devices.ErrRemoved) {
		t.Fatalf("removed: %v", err)
	}
}
