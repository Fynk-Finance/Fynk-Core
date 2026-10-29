package ports

import (
	"context"
	"errors"
	"sort"
	"testing"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

func TestNewDeviceReaderBuildsWithoutPool(t *testing.T) {
	if NewDeviceReader(nil, clock.System{}, noAudit{}, nil) == nil {
		t.Fatal("NewDeviceReader returned nil")
	}
}

type fakeRevoker struct {
	got []string
	err error
}

func (f *fakeRevoker) DeleteSession(_ context.Context, sid string) error {
	f.got = append(f.got, sid)
	return f.err
}

type fakeRepo struct{ rows map[string]devices.Device }

func (r *fakeRepo) Get(_ context.Context, userID, id string) (devices.Device, error) {
	d, ok := r.rows[id]
	if !ok || d.UserID != userID {
		return devices.Device{}, devices.ErrNotFound
	}
	return d, nil
}

func (r *fakeRepo) List(_ context.Context, userID string) ([]devices.Device, error) {
	var out []devices.Device
	for _, d := range r.rows {
		if d.UserID == userID && d.Status != devices.StatusRemoved {
			out = append(out, d)
		}
	}
	return out, nil
}

func (r *fakeRepo) InTx(_ context.Context, _ string, fn func(devices.Tx) error) error {
	return fn(&fakeTx{r})
}

func (r *fakeRepo) Activate(context.Context, string) error { return nil }

type fakeTx struct{ *fakeRepo }

func (*fakeTx) ByIdempotencyKey(context.Context, string, string) (devices.Device, bool, error) {
	return devices.Device{}, false, nil
}

func (*fakeTx) ByPublicKey(context.Context, string, []byte) (devices.Device, bool, error) {
	return devices.Device{}, false, nil
}

func (*fakeTx) HasActive(context.Context, string) (bool, error)      { return true, nil }
func (*fakeTx) Insert(context.Context, devices.Device, string) error { return nil }

func (t *fakeTx) Update(_ context.Context, d devices.Device) error {
	t.rows[d.ID] = d
	return nil
}

type fakeAudit struct{ events []audit.Event }

func (f *fakeAudit) Record(_ context.Context, e audit.Event) error {
	f.events = append(f.events, e)
	return nil
}

func newReader(rv SessionRevoker) (deviceReader, *fakeAudit) {
	rows := map[string]devices.Device{
		"a": {ID: "a", UserID: "u1", Name: "Pixel", Platform: devices.PlatformAndroid, PublicKey: []byte{1}, Status: devices.StatusActive, SessionID: "sa"},
		"b": {ID: "b", UserID: "u1", Status: devices.StatusPending, SessionID: "sb"},
		"c": {ID: "c", UserID: "u1", Status: devices.StatusPending, SessionID: "sc"},
		"r": {ID: "r", UserID: "u1", Status: devices.StatusRemoved},
	}
	rec := &fakeAudit{}
	svc := devices.NewService(&fakeRepo{rows}, clock.System{}, rec, nil)
	return deviceReader{svc: svc, revoker: rv}, rec
}

func TestReaderGetMapsDeviceAndErrors(t *testing.T) {
	r, _ := newReader(nil)
	ctx := context.Background()
	d, err := r.Get(ctx, "u1", "a")
	if err != nil || d.ID != "a" || d.Platform != "android" || d.Status != "active" || d.Name != "Pixel" || len(d.PublicKey) != 1 {
		t.Fatalf("d = %+v err %v", d, err)
	}
	if _, err := r.Get(ctx, "u2", "a"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign: %v", err)
	}
	if _, err := r.Get(ctx, "u1", "zz"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
	if _, err := r.Get(ctx, "u1", "r"); !errors.Is(err, ErrRemoved) {
		t.Fatalf("removed: %v", err)
	}
}

// The port has no active check: M2 did its own, so a pending device can be the one kept.
func TestReaderRemoveOthersRevokesSessionsAndAudits(t *testing.T) {
	rv := &fakeRevoker{}
	r, rec := newReader(rv)
	if err := r.RemoveOthers(context.Background(), "u1", "b"); err != nil {
		t.Fatal(err)
	}
	sort.Strings(rv.got)
	if len(rv.got) != 2 || rv.got[0] != "sa" || rv.got[1] != "sc" {
		t.Fatalf("revoked %v", rv.got)
	}
	if len(rec.events) != 2 || rec.events[0].Type != audit.DeviceRemoved {
		t.Fatalf("events = %+v", rec.events)
	}
}

func TestReaderRemoveOthersKeepsGoingWhenRevocationFails(t *testing.T) {
	rv := &fakeRevoker{err: errors.New("keycloak down")}
	r, _ := newReader(rv)
	if err := r.RemoveOthers(context.Background(), "u1", "a"); err != nil {
		t.Fatal(err)
	}
	if len(rv.got) != 2 {
		t.Fatalf("revoked %v", rv.got)
	}
}

func TestReaderRemoveOthersErrors(t *testing.T) {
	r, _ := newReader(nil)
	if err := r.RemoveOthers(context.Background(), "u1", "r"); !errors.Is(err, ErrRemoved) {
		t.Fatalf("removed: %v", err)
	}
	if err := r.RemoveOthers(context.Background(), "u1", "zz"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
}
