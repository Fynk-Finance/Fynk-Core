package devices_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/token"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var _ token.DeviceChecker = (*devices.Service)(nil)

// fakeRepo is an in-memory Repo. InTx works on a copy, so a failed fn changes nothing.
type fakeRepo struct {
	rows map[string]devices.Device
	idem map[string]string // userID|key -> device id
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{rows: map[string]devices.Device{}, idem: map[string]string{}}
}

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
	sort.Slice(out, func(i, j int) bool {
		if !out[i].LastSeenAt.Equal(out[j].LastSeenAt) {
			return out[i].LastSeenAt.After(out[j].LastSeenAt)
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (r *fakeRepo) InTx(_ context.Context, _ string, fn func(devices.Tx) error) error {
	t := &fakeTx{fakeRepo: &fakeRepo{rows: map[string]devices.Device{}, idem: map[string]string{}}}
	for k, v := range r.rows {
		t.rows[k] = v
	}
	for k, v := range r.idem {
		t.idem[k] = v
	}
	if err := fn(t); err != nil {
		return err
	}
	r.rows, r.idem = t.rows, t.idem
	return nil
}

func (r *fakeRepo) Activate(_ context.Context, id string) error {
	d, ok := r.rows[id]
	switch {
	case !ok:
		return devices.ErrNotFound
	case d.Status == devices.StatusRemoved:
		return devices.ErrRemoved
	}
	d.Status = devices.StatusActive
	r.rows[id] = d
	return nil
}

type fakeTx struct{ *fakeRepo }

func (t *fakeTx) ByIdempotencyKey(_ context.Context, userID, key string) (devices.Device, bool, error) {
	id, ok := t.idem[userID+"|"+key]
	return t.rows[id], ok, nil
}

func (t *fakeTx) ByPublicKey(_ context.Context, userID string, key []byte) (devices.Device, bool, error) {
	for _, d := range t.rows {
		if d.UserID == userID && bytes.Equal(d.PublicKey, key) {
			return d, true, nil
		}
	}
	return devices.Device{}, false, nil
}

func (t *fakeTx) HasActive(_ context.Context, userID string) (bool, error) {
	for _, d := range t.rows {
		if d.UserID == userID && d.Status == devices.StatusActive {
			return true, nil
		}
	}
	return false, nil
}

func (t *fakeTx) Insert(_ context.Context, d devices.Device, key string) error {
	t.rows[d.ID] = d
	if key != "" {
		t.idem[d.UserID+"|"+key] = d.ID
	}
	return nil
}

func (t *fakeTx) Update(_ context.Context, d devices.Device) error {
	if _, ok := t.rows[d.ID]; !ok {
		return devices.ErrNotFound
	}
	t.rows[d.ID] = d
	return nil
}

type recorder struct {
	events []audit.Event
	err    error
}

func (r *recorder) Record(_ context.Context, e audit.Event) error {
	if r.err != nil {
		return r.err
	}
	r.events = append(r.events, e)
	return nil
}

type env struct {
	svc *devices.Service
	clk *clock.Fixed
	rec *recorder
}

var t0 = time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)

func setup() env {
	n := 0
	clk := clock.NewFixed(t0)
	rec := &recorder{}
	svc := devices.NewService(newFakeRepo(), clk, rec, func() string { n++; return fmt.Sprintf("dev-%d", n) })
	return env{svc, clk, rec}
}

func key(b byte) []byte { return bytes.Repeat([]byte{b}, 32) }

func in(b byte) devices.RegisterInput {
	return devices.RegisterInput{Name: "Pixel de Ana", Platform: devices.PlatformAndroid, PublicKey: key(b)}
}

func user(id string) auth.User { return auth.User{ID: id, SessionID: "sid-" + id} }

func mustRegister(t *testing.T, e env, u auth.User, b byte) devices.Device {
	t.Helper()
	d, created, err := e.svc.Register(context.Background(), u, in(b), "")
	if err != nil || !created {
		t.Fatalf("register: created=%v err=%v", created, err)
	}
	return d
}

func TestFirstDeviceIsActiveAndSecondPending(t *testing.T) {
	e := setup()
	a := mustRegister(t, e, user("u1"), 1)
	b := mustRegister(t, e, user("u1"), 2)
	other := mustRegister(t, e, user("u2"), 3)
	if a.Status != devices.StatusActive || b.Status != devices.StatusPending || other.Status != devices.StatusActive {
		t.Fatalf("statuses = %s %s %s", a.Status, b.Status, other.Status)
	}
	if !a.CreatedAt.Equal(t0) || !a.LastSeenAt.Equal(t0) || a.SessionID != "sid-u1" {
		t.Fatalf("device = %+v", a)
	}
}

func TestNewDeviceIsActiveAfterRemovingTheOnlyActiveOne(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	if _, err := e.svc.Remove(ctx, "u1", a.ID); err != nil {
		t.Fatal(err)
	}
	if b := mustRegister(t, e, user("u1"), 2); b.Status != devices.StatusActive {
		t.Fatalf("status = %s, want active", b.Status)
	}
}

func TestRegisterAuditsOnlyPlatformAndStatus(t *testing.T) {
	e := setup()
	d := mustRegister(t, e, user("u1"), 1)
	if len(e.rec.events) != 1 {
		t.Fatalf("events = %d", len(e.rec.events))
	}
	ev := e.rec.events[0]
	if ev.Type != audit.DeviceRegistered || ev.UserID != "u1" || ev.DeviceID != d.ID || !ev.At.Equal(t0) {
		t.Fatalf("event = %+v", ev)
	}
	if len(ev.Meta) != 2 || ev.Meta["platform"] != "android" || ev.Meta["status"] != "active" {
		t.Fatalf("meta = %v", ev.Meta)
	}
	if s := fmt.Sprint(ev); strings.Contains(s, "Pixel") {
		t.Fatalf("event leaks the name: %s", s)
	}
}

func TestRegisterReturnsAuditFailure(t *testing.T) {
	e := setup()
	e.rec.err = errors.New("audit down")
	if _, _, err := e.svc.Register(context.Background(), user("u1"), in(1), ""); err == nil {
		t.Fatal("want the audit error")
	}
}

func TestIdempotencyKeyReturnsTheFirstResult(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a, created, err := e.svc.Register(ctx, user("u1"), in(1), "k1")
	if err != nil || !created {
		t.Fatal(created, err)
	}
	other := in(9) // a different body: the first result still wins
	other.Name = "Otro"
	b, created, err := e.svc.Register(ctx, user("u1"), other, "k1")
	if err != nil || created || b.ID != a.ID {
		t.Fatalf("created=%v err=%v id=%s want %s", created, err, b.ID, a.ID)
	}
	if len(e.rec.events) != 1 {
		t.Fatalf("events = %d, want 1", len(e.rec.events))
	}
	// The same key for another user is a different registration.
	if c, created, err := e.svc.Register(ctx, user("u2"), in(1), "k1"); err != nil || !created || c.ID == a.ID {
		t.Fatalf("other user: created=%v err=%v", created, err)
	}
}

func TestSamePublicKeyReturnsTheExistingDevice(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	b, created, err := e.svc.Register(ctx, user("u1"), in(1), "")
	if err != nil || created || b.ID != a.ID {
		t.Fatalf("created=%v err=%v", created, err)
	}
}

func TestRemovedPublicKeyIsRejected(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	if _, err := e.svc.Remove(ctx, "u1", a.ID); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.svc.Register(ctx, user("u1"), in(1), ""); !errors.Is(err, devices.ErrKeyRemoved) {
		t.Fatalf("err = %v", err)
	}
}

func TestRegisterValidation(t *testing.T) {
	e := setup()
	ctx := context.Background()
	cases := map[string]devices.RegisterInput{
		"empty name":       {Name: "  ", Platform: devices.PlatformIOS, PublicKey: key(1)},
		"long name":        {Name: strings.Repeat("a", 65), Platform: devices.PlatformIOS, PublicKey: key(1)},
		"control char":     {Name: "a\nb", Platform: devices.PlatformIOS, PublicKey: key(1)},
		"bad platform":     {Name: "x", Platform: "windows", PublicKey: key(1)},
		"short key":        {Name: "x", Platform: devices.PlatformIOS, PublicKey: key(1)[:31]},
		"long key":         {Name: "x", Platform: devices.PlatformIOS, PublicKey: append(key(1), 0)},
		"nil key":          {Name: "x", Platform: devices.PlatformIOS},
		"unknown platform": {Name: "x", Platform: "", PublicKey: key(1)},
	}
	for name, c := range cases {
		_, _, err := e.svc.Register(ctx, user("u1"), c, "")
		if !errors.Is(err, devices.ErrInvalid) {
			t.Errorf("%s: err = %v", name, err)
		} else if strings.Contains(err.Error(), "windows") {
			t.Errorf("%s: error echoes a value: %v", name, err)
		}
	}
	// 64 multi-byte runes are fine, and the name is trimmed.
	ok := devices.RegisterInput{Name: "  " + strings.Repeat("ñ", 64) + " ", Platform: devices.PlatformIOS, PublicKey: key(1)}
	d, _, err := e.svc.Register(ctx, user("u1"), ok, "")
	if err != nil || d.Name != strings.Repeat("ñ", 64) {
		t.Fatalf("err=%v name len=%d", err, len(d.Name))
	}
}

func TestOtherUsersDeviceIsNotFound(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	if _, err := e.svc.Current(ctx, user("u2"), a.ID); !errors.Is(err, devices.ErrNotFound) {
		t.Errorf("Current: %v", err)
	}
	if _, err := e.svc.Remove(ctx, "u2", a.ID); !errors.Is(err, devices.ErrNotFound) {
		t.Errorf("Remove: %v", err)
	}
	if _, err := e.svc.RemoveOthers(ctx, "u2", a.ID); !errors.Is(err, devices.ErrNotFound) {
		t.Errorf("RemoveOthers: %v", err)
	}
	if _, err := e.svc.Remove(ctx, "u1", "missing"); !errors.Is(err, devices.ErrNotFound) {
		t.Errorf("missing: %v", err)
	}
}

func TestListHidesRemovedAndSortsByLastSeen(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	e.clk.Advance(time.Minute)
	b := mustRegister(t, e, user("u1"), 2)
	e.clk.Advance(time.Minute)
	c := mustRegister(t, e, user("u1"), 3)
	if _, err := e.svc.Remove(ctx, "u1", b.ID); err != nil {
		t.Fatal(err)
	}
	e.clk.Advance(time.Minute)
	if _, err := e.svc.Current(ctx, user("u1"), a.ID); err != nil {
		t.Fatal(err)
	}
	list, err := e.svc.List(ctx, "u1")
	if err != nil || len(list) != 2 || list[0].ID != a.ID || list[1].ID != c.ID {
		t.Fatalf("list = %v, %v", list, err)
	}
}

func TestCurrentUpdatesLastSeenAndSession(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	e.clk.Advance(time.Hour)
	d, err := e.svc.Current(ctx, auth.User{ID: "u1", SessionID: "new-sid"}, a.ID)
	if err != nil || d.SessionID != "new-sid" || !d.LastSeenAt.Equal(t0.Add(time.Hour)) {
		t.Fatalf("device = %+v, %v", d, err)
	}
	d, err = e.svc.Current(ctx, auth.User{ID: "u1"}, a.ID) // no sid: keeps the stored one
	if err != nil || d.SessionID != "new-sid" {
		t.Fatalf("device = %+v, %v", d, err)
	}
	if _, err := e.svc.Remove(ctx, "u1", a.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Current(ctx, user("u1"), a.ID); !errors.Is(err, devices.ErrRemoved) {
		t.Fatalf("err = %v", err)
	}
}

func TestRemoveTwiceAuditsOnce(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	sid, err := e.svc.Remove(ctx, "u1", a.ID)
	if err != nil || sid != "sid-u1" {
		t.Fatalf("sid=%q err=%v", sid, err)
	}
	sid, err = e.svc.Remove(ctx, "u1", a.ID)
	if err != nil || sid != "" {
		t.Fatalf("second: sid=%q err=%v", sid, err)
	}
	removed := 0
	for _, ev := range e.rec.events {
		if ev.Type == audit.DeviceRemoved {
			removed++
			if ev.Meta["reason"] != "user" || len(ev.Meta) != 1 || ev.DeviceID != a.ID {
				t.Fatalf("event = %+v", ev)
			}
		}
	}
	if removed != 1 {
		t.Fatalf("removed events = %d", removed)
	}
}

func TestRemoveOthers(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	b := mustRegister(t, e, auth.User{ID: "u1", SessionID: "sid-b"}, 2)
	c := mustRegister(t, e, auth.User{ID: "u1"}, 3) // no session
	x := mustRegister(t, e, user("u2"), 4)
	sids, err := e.svc.RemoveOthers(ctx, "u1", a.ID)
	if err != nil {
		t.Fatal(err)
	}
	list, _ := e.svc.List(ctx, "u1")
	if len(list) != 1 || list[0].ID != a.ID {
		t.Fatalf("list = %v", list)
	}
	if list, _ := e.svc.List(ctx, "u2"); len(list) != 1 || list[0].ID != x.ID {
		t.Fatal("other user touched")
	}
	events := 0
	for _, ev := range e.rec.events {
		if ev.Type == audit.DeviceRemoved {
			events++
			if ev.Meta["reason"] != "others" || (ev.DeviceID != b.ID && ev.DeviceID != c.ID) {
				t.Fatalf("event = %+v", ev)
			}
		}
	}
	if events != 2 {
		t.Fatalf("events = %d", events)
	}
	if len(sids) != 1 || sids[0] != "sid-b" {
		t.Fatalf("sids = %v, want only sid-b (c has no session)", sids)
	}
	// The current device must be usable.
	if _, err := e.svc.RemoveOthers(ctx, "u1", b.ID); !errors.Is(err, devices.ErrRemoved) {
		t.Fatalf("removed current: %v", err)
	}
	if _, err := e.svc.RemoveOthers(ctx, "u1", "missing"); !errors.Is(err, devices.ErrNotFound) {
		t.Fatalf("missing current: %v", err)
	}
}

func TestUsable(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	b := mustRegister(t, e, user("u1"), 2) // pending
	if _, err := e.svc.Remove(ctx, "u1", a.ID); err != nil {
		t.Fatal(err)
	}
	for name, c := range map[string]struct {
		user, id string
		want     bool
	}{
		"removed":    {"u1", a.ID, false},
		"pending":    {"u1", b.ID, true},
		"other user": {"u2", b.ID, false},
		"missing":    {"u1", "nope", false},
	} {
		got, err := e.svc.Usable(ctx, c.user, c.id)
		if err != nil || got != c.want {
			t.Errorf("%s: got %v, %v", name, got, err)
		}
	}
	c := mustRegister(t, e, user("u3"), 5)
	if ok, _ := e.svc.Usable(ctx, "u3", c.ID); !ok {
		t.Error("active device is not usable")
	}
}

func TestActivate(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := mustRegister(t, e, user("u1"), 1)
	b := mustRegister(t, e, user("u1"), 2)
	if err := e.svc.Activate(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.Activate(ctx, a.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.svc.Remove(ctx, "u1", a.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.svc.Activate(ctx, a.ID); !errors.Is(err, devices.ErrRemoved) {
		t.Fatalf("err = %v", err)
	}
	if err := e.svc.Activate(ctx, "nope"); !errors.Is(err, devices.ErrNotFound) {
		t.Fatalf("err = %v", err)
	}
}

func TestDeviceFormattingHidesNameAndKey(t *testing.T) {
	d := devices.Device{ID: "d1", Name: "Pixel de Ana", PublicKey: key(7), Status: devices.StatusActive, Platform: devices.PlatformIOS}
	for _, s := range []string{fmt.Sprint(d), fmt.Sprintf("%v", d), fmt.Sprintf("%+v", d), fmt.Sprintf("%#v", d), fmt.Sprint(&d)} {
		if strings.Contains(s, "Pixel") || strings.Contains(s, "7 7") || strings.Contains(s, "BwcH") {
			t.Errorf("leaks: %s", s)
		}
	}
}
