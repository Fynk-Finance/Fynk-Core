package approvals_test

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/approvals"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var now = time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)

// memRepo keeps approvals in memory; InTx works on a copy that is dropped on error.
type memRepo struct {
	rows map[string]approvals.Approval
	keys map[string]string // device + "/" + key -> id
}

func newRepo() *memRepo {
	return &memRepo{rows: map[string]approvals.Approval{}, keys: map[string]string{}}
}

type memTx struct{ r *memRepo }

func (t memTx) ByKey(_ context.Context, dev, key string) (approvals.Approval, bool, error) {
	id, ok := t.r.keys[dev+"/"+key]
	return t.r.rows[id], ok, nil
}
func (t memTx) ExpirePending(_ context.Context, dev string, at time.Time) error {
	for id, a := range t.r.rows {
		if a.NewDeviceID == dev && a.Status == approvals.Pending {
			a.Status, a.DecidedAt = approvals.Expired, &at
			t.r.rows[id] = a
		}
	}
	return nil
}
func (t memTx) Insert(_ context.Context, a approvals.Approval, key string) error {
	t.r.rows[a.ID] = a
	if key != "" {
		t.r.keys[a.NewDeviceID+"/"+key] = a.ID
	}
	return nil
}
func (t memTx) Lock(_ context.Context, id string) (approvals.Approval, error) {
	a, ok := t.r.rows[id]
	if !ok {
		return approvals.Approval{}, approvals.ErrNotFound
	}
	return a, nil
}
func (t memTx) Decide(_ context.Context, id string, s approvals.Status, at time.Time) error {
	a := t.r.rows[id]
	a.Status, a.DecidedAt = s, &at
	t.r.rows[id] = a
	return nil
}
func (t memTx) Approve(_ context.Context, id string, g approvals.Grant, at time.Time) error {
	a := t.r.rows[id]
	a.Status, a.Grant, a.DecidedAt = approvals.Approved, g, &at
	t.r.rows[id] = a
	return nil
}
func (t memTx) ClearGrant(_ context.Context, id string) error {
	a := t.r.rows[id]
	a.Grant = approvals.Grant{}
	t.r.rows[id] = a
	return nil
}

func (r *memRepo) InTx(_ context.Context, _ string, fn func(approvals.Tx) error) error {
	saved, keys := map[string]approvals.Approval{}, map[string]string{}
	for k, v := range r.rows {
		saved[k] = v
	}
	for k, v := range r.keys {
		keys[k] = v
	}
	if err := fn(memTx{r}); err != nil {
		r.rows, r.keys = saved, keys
		return err
	}
	return nil
}

func (r *memRepo) Open(_ context.Context, user string, at time.Time) ([]approvals.Approval, error) {
	var out []approvals.Approval
	for _, a := range r.rows {
		if a.UserID == user && a.Status == approvals.Pending && a.ExpiresAt.After(at) {
			out = append(out, a)
		}
	}
	for i := range out { // newest first
		for j := i + 1; j < len(out); j++ {
			if out[j].CreatedAt.After(out[i].CreatedAt) {
				out[i], out[j] = out[j], out[i]
			}
		}
	}
	return out, nil
}

// fakeIdentity is the Devices port and the Activator over one map.
type fakeIdentity struct {
	devs   map[string]identity.DeviceInfo
	gone   map[string]error // device -> ErrRemoved / ErrNotFound
	actErr error
}

func (f *fakeIdentity) Get(_ context.Context, _, id string) (identity.DeviceInfo, error) {
	if err, ok := f.gone[id]; ok {
		return identity.DeviceInfo{}, err
	}
	d, ok := f.devs[id]
	if !ok {
		return identity.DeviceInfo{}, identity.ErrNotFound
	}
	return d, nil
}
func (*fakeIdentity) RemoveOthers(context.Context, string, string) error { return nil }
func (f *fakeIdentity) ActivateDevice(_ context.Context, id string) error {
	if f.actErr != nil {
		return f.actErr
	}
	d := f.devs[id]
	d.Status = "active"
	f.devs[id] = d
	return nil
}

type fakeAudit struct{ events []audit.Event }

func (f *fakeAudit) Record(_ context.Context, e audit.Event) error {
	f.events = append(f.events, e)
	return nil
}

var (
	oldPhone = auth.User{ID: "u1", DeviceID: "old"}
	newPhone = auth.User{ID: "u1", DeviceID: "new"}
	pubKey   = bytes.Repeat([]byte{9}, 32)
	grant    = approvals.Grant{EphemeralPublicKey: bytes.Repeat([]byte{1}, 32), WrappedDEK: bytes.Repeat([]byte{2}, 48), Nonce: bytes.Repeat([]byte{3}, 12)}
)

type env struct {
	s    *approvals.Service
	repo *memRepo
	id   *fakeIdentity
	clk  *clock.Fixed
	rec  *fakeAudit
	seq  int
}

func setup() *env {
	e := &env{repo: newRepo(), clk: clock.NewFixed(now), rec: &fakeAudit{}, id: &fakeIdentity{
		devs: map[string]identity.DeviceInfo{
			"old": {ID: "old", Name: "iPhone", Platform: "ios", Status: "active", PublicKey: bytes.Repeat([]byte{8}, 32)},
			"new": {ID: "new", Name: "Pixel", Platform: "android", Status: "pending", PublicKey: pubKey},
		}, gone: map[string]error{}}}
	e.s = approvals.NewService(e.repo, e.id, e.id, e.clk, e.rec, func() string { e.seq++; return fmt.Sprintf("a%d", e.seq) })
	return e
}

func (e *env) create(t *testing.T) approvals.Approval {
	t.Helper()
	a, err := e.s.Create(context.Background(), newPhone, "")
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func TestCreateTakesPublicKeyFromIdentityAndExpiresInTenMinutes(t *testing.T) {
	e := setup()
	a := e.create(t)
	stored := e.repo.rows[a.ID]
	if a.Status != approvals.Pending || !a.ExpiresAt.Equal(now.Add(10*time.Minute)) || !a.CreatedAt.Equal(now) {
		t.Fatalf("got %+v", a)
	}
	if !bytes.Equal(stored.NewDevicePublicKey, pubKey) || stored.NewDeviceID != "new" || stored.UserID != "u1" {
		t.Fatalf("stored %+v", stored)
	}
	if len(a.NewDevicePublicKey) != 0 {
		t.Fatal("create returned the key")
	}
}

func TestCreateByNonPendingDevice(t *testing.T) {
	e := setup()
	ctx := context.Background()
	if _, err := e.s.Create(ctx, oldPhone, ""); !errors.Is(err, approvals.ErrAlreadyActive) {
		t.Fatalf("active: %v", err)
	}
	e.id.gone["new"] = identity.ErrRemoved
	if _, err := e.s.Create(ctx, newPhone, ""); !errors.Is(err, approvals.ErrNotActive) {
		t.Fatalf("removed: %v", err)
	}
	if _, err := e.s.Create(ctx, auth.User{ID: "u1", DeviceID: "ghost"}, ""); !errors.Is(err, approvals.ErrNotActive) {
		t.Fatalf("unknown: %v", err)
	}
	if _, err := e.s.Create(ctx, auth.User{ID: "u1"}, ""); !errors.Is(err, approvals.ErrNotActive) {
		t.Fatalf("no device: %v", err)
	}
	if len(e.repo.rows) != 0 {
		t.Fatal("a request was stored")
	}
}

func TestCreateIsIdempotentPerDeviceAndKey(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a, err := e.s.Create(ctx, newPhone, "k1")
	if err != nil {
		t.Fatal(err)
	}
	e.clk.Advance(time.Minute)
	b, err := e.s.Create(ctx, newPhone, "k1")
	if err != nil || b.ID != a.ID || !b.CreatedAt.Equal(a.CreatedAt) || len(e.repo.rows) != 1 {
		t.Fatalf("replay: %+v %v rows=%d", b, err, len(e.repo.rows))
	}
	c, err := e.s.Create(ctx, newPhone, "k2")
	if err != nil || c.ID == a.ID {
		t.Fatalf("new key: %+v %v", c, err)
	}
}

func TestCreateExpiresTheOlderOpenRequest(t *testing.T) {
	e := setup()
	first := e.create(t)
	e.clk.Advance(time.Minute)
	second := e.create(t)
	if e.repo.rows[first.ID].Status != approvals.Expired || e.repo.rows[second.ID].Status != approvals.Pending {
		t.Fatalf("statuses %s %s", e.repo.rows[first.ID].Status, e.repo.rows[second.ID].Status)
	}
	if _, err := e.s.Approve(context.Background(), oldPhone, first.ID, grant); !errors.Is(err, approvals.ErrExpired) {
		t.Fatalf("approve superseded: %v", err)
	}
}

func TestPendingListsOnlyOpenRequestsOfActiveCaller(t *testing.T) {
	e := setup()
	ctx := context.Background()
	older := e.create(t)
	e.id.devs["new2"] = identity.DeviceInfo{ID: "new2", Name: "Galaxy", Platform: "android", Status: "pending", PublicKey: pubKey}
	e.clk.Advance(time.Minute)
	n2, err := e.s.Create(ctx, auth.User{ID: "u1", DeviceID: "new2"}, "")
	if err != nil {
		t.Fatal(err)
	}
	// Another user's request, an expired one and one whose device was removed are not listed.
	e.repo.rows["other"] = approvals.Approval{ID: "other", UserID: "u2", NewDeviceID: "x", Status: approvals.Pending, ExpiresAt: now.Add(time.Hour), CreatedAt: now}
	e.id.devs["new3"] = identity.DeviceInfo{ID: "new3", Status: "pending"}
	e.repo.rows["gone"] = approvals.Approval{ID: "gone", UserID: "u1", NewDeviceID: "new3", Status: approvals.Pending, ExpiresAt: now.Add(time.Hour), CreatedAt: now}
	e.id.gone["new3"] = identity.ErrRemoved
	e.id.devs["new4"] = identity.DeviceInfo{ID: "new4", Status: "active"}
	e.repo.rows["act"] = approvals.Approval{ID: "act", UserID: "u1", NewDeviceID: "new4", Status: approvals.Pending, ExpiresAt: now.Add(time.Hour), CreatedAt: now}

	got, err := e.s.Pending(ctx, oldPhone)
	if err != nil || len(got) != 2 || got[0].ID != n2.ID || got[1].ID != older.ID {
		t.Fatalf("got %+v %v", got, err)
	}
	if got[0].DeviceName != "Galaxy" || got[0].Platform != "android" || !bytes.Equal(got[0].NewDevicePublicKey, pubKey) {
		t.Fatalf("details %+v", got[0])
	}
	e.clk.Advance(9 * time.Minute) // now+10: the first is at its expiry, the second a minute from it
	got, err = e.s.Pending(ctx, oldPhone)
	if err != nil || len(got) != 1 || got[0].ID != n2.ID {
		t.Fatalf("after expiry: %+v %v", got, err)
	}
}

func TestNonActiveDeviceCannotListApproveOrReject(t *testing.T) {
	ctx := context.Background()
	for name, mut := range map[string]func(*env){
		"pending": func(*env) {},
		"removed": func(e *env) { e.id.gone["new"] = identity.ErrRemoved },
		"unknown": func(e *env) { delete(e.id.devs, "new") },
	} {
		e := setup()
		a := e.create(t)
		mut(e)
		if _, err := e.s.Pending(ctx, newPhone); !errors.Is(err, approvals.ErrNotActive) {
			t.Fatalf("%s list: %v", name, err)
		}
		if _, err := e.s.Approve(ctx, newPhone, a.ID, grant); !errors.Is(err, approvals.ErrNotActive) {
			t.Fatalf("%s approve: %v", name, err)
		}
		if _, err := e.s.Reject(ctx, newPhone, a.ID); !errors.Is(err, approvals.ErrNotActive) {
			t.Fatalf("%s reject: %v", name, err)
		}
		if e.repo.rows[a.ID].Status != approvals.Pending || len(e.rec.events) != 0 {
			t.Fatalf("%s: state changed", name)
		}
	}
}

func TestApproveStoresGrantActivatesAndAudits(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := e.create(t)
	e.clk.Advance(time.Minute)
	got, err := e.s.Approve(ctx, oldPhone, a.ID, grant)
	if err != nil || got.Status != approvals.Approved {
		t.Fatalf("%+v %v", got, err)
	}
	stored := e.repo.rows[a.ID]
	if stored.Status != approvals.Approved || !bytes.Equal(stored.Grant.WrappedDEK, grant.WrappedDEK) || stored.DecidedAt == nil {
		t.Fatalf("stored %+v", stored)
	}
	if e.id.devs["new"].Status != "active" {
		t.Fatal("device not activated")
	}
	if len(e.rec.events) != 1 {
		t.Fatalf("events %+v", e.rec.events)
	}
	ev := e.rec.events[0]
	if ev.Type != audit.DeviceApproved || ev.DeviceID != "new" || ev.UserID != "u1" ||
		len(ev.Meta) != 2 || ev.Meta["method"] != "device_approval" || ev.Meta["approvedBy"] != "old" {
		t.Fatalf("event %+v", ev)
	}
	if _, err := e.s.Approve(ctx, oldPhone, a.ID, grant); !errors.Is(err, approvals.ErrNotPending) {
		t.Fatalf("second approve: %v", err)
	}
}

func TestActivationErrorRollsBackTheApproval(t *testing.T) {
	e := setup()
	a := e.create(t)
	e.id.actErr = errors.New("db down")
	if _, err := e.s.Approve(context.Background(), oldPhone, a.ID, grant); err == nil {
		t.Fatal("no error")
	}
	if got := e.repo.rows[a.ID]; got.Status != approvals.Pending || len(got.Grant.WrappedDEK) != 0 || got.DecidedAt != nil {
		t.Fatalf("not rolled back: %+v", got)
	}
	if len(e.rec.events) != 0 {
		t.Fatal("audited a failed approval")
	}
	e.id.actErr = identity.ErrRemoved
	if _, err := e.s.Approve(context.Background(), oldPhone, a.ID, grant); !errors.Is(err, approvals.ErrNotPending) {
		t.Fatalf("removed during approve: %v", err)
	}
}

func TestExpiredCannotBeApprovedOrRejectedAndIsStored(t *testing.T) {
	for _, reject := range []bool{false, true} {
		e := setup()
		ctx := context.Background()
		a := e.create(t)
		e.clk.Advance(approvals.TTL) // exactly at the expiry already counts as expired
		var err error
		if reject {
			_, err = e.s.Reject(ctx, oldPhone, a.ID)
		} else {
			_, err = e.s.Approve(ctx, oldPhone, a.ID, grant)
		}
		if !errors.Is(err, approvals.ErrExpired) {
			t.Fatalf("reject=%v: %v", reject, err)
		}
		if e.repo.rows[a.ID].Status != approvals.Expired || e.id.devs["new"].Status != "pending" || len(e.rec.events) != 0 {
			t.Fatalf("reject=%v: %+v", reject, e.repo.rows[a.ID])
		}
		// A later call on the stored expired request is still expired.
		if _, err := e.s.Approve(ctx, oldPhone, a.ID, grant); !errors.Is(err, approvals.ErrExpired) {
			t.Fatalf("again: %v", err)
		}
	}
}

func TestApproveJustBeforeExpiryWorks(t *testing.T) {
	e := setup()
	a := e.create(t)
	e.clk.Advance(approvals.TTL - time.Second)
	if _, err := e.s.Approve(context.Background(), oldPhone, a.ID, grant); err != nil {
		t.Fatal(err)
	}
}

func TestDecideNotFoundAndNotPending(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := e.create(t)
	if _, err := e.s.Approve(ctx, oldPhone, "missing", grant); !errors.Is(err, approvals.ErrNotFound) {
		t.Fatalf("unknown: %v", err)
	}
	other := auth.User{ID: "u2", DeviceID: "old2"}
	e.id.devs["old2"] = identity.DeviceInfo{ID: "old2", Status: "active"}
	if _, err := e.s.Approve(ctx, other, a.ID, grant); !errors.Is(err, approvals.ErrNotFound) {
		t.Fatalf("another user: %v", err)
	}
	if _, err := e.s.Reject(ctx, other, a.ID); !errors.Is(err, approvals.ErrNotFound) {
		t.Fatalf("another user reject: %v", err)
	}
	// The new device was removed or activated by other means: the request cannot be decided.
	e.id.gone["new"] = identity.ErrRemoved
	if _, err := e.s.Approve(ctx, oldPhone, a.ID, grant); !errors.Is(err, approvals.ErrNotPending) {
		t.Fatalf("removed: %v", err)
	}
	delete(e.id.gone, "new")
	d := e.id.devs["new"]
	d.Status = "active"
	e.id.devs["new"] = d
	if _, err := e.s.Reject(ctx, oldPhone, a.ID); !errors.Is(err, approvals.ErrNotPending) {
		t.Fatalf("already active: %v", err)
	}
	if e.repo.rows[a.ID].Status != approvals.Pending {
		t.Fatal("status changed")
	}
}

func TestRejectKeepsNewDevicePendingAndAudits(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := e.create(t)
	got, err := e.s.Reject(ctx, oldPhone, a.ID)
	if err != nil || got.Status != approvals.Rejected {
		t.Fatalf("%+v %v", got, err)
	}
	if e.repo.rows[a.ID].Status != approvals.Rejected || e.repo.rows[a.ID].DecidedAt == nil || e.id.devs["new"].Status != "pending" {
		t.Fatalf("stored %+v", e.repo.rows[a.ID])
	}
	ev := e.rec.events[0]
	if len(e.rec.events) != 1 || ev.Type != audit.DeviceRejected || ev.DeviceID != "new" ||
		len(ev.Meta) != 2 || ev.Meta["method"] != "device_approval" || ev.Meta["rejectedBy"] != "old" {
		t.Fatalf("events %+v", e.rec.events)
	}
	if _, err := e.s.Reject(ctx, oldPhone, a.ID); !errors.Is(err, approvals.ErrNotPending) {
		t.Fatalf("second reject: %v", err)
	}
}

func TestGetBelongsOnlyToTheCreatingDevice(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := e.create(t)
	for name, u := range map[string]auth.User{
		"old phone":    oldPhone,
		"other user":   {ID: "u2", DeviceID: "new"},
		"other device": {ID: "u1", DeviceID: "ghost"},
		"no device":    {ID: "u1"},
	} {
		if _, err := e.s.Get(ctx, u, a.ID); !errors.Is(err, approvals.ErrNotFound) {
			t.Fatalf("%s: %v", name, err)
		}
	}
	if _, err := e.s.Get(ctx, newPhone, "missing"); !errors.Is(err, approvals.ErrNotFound) {
		t.Fatalf("missing: %v", err)
	}
	v, err := e.s.Get(ctx, newPhone, a.ID)
	if err != nil || v.Status != approvals.Pending || v.Keys != nil || len(v.NewDevicePublicKey) != 0 {
		t.Fatalf("pending: %+v %v", v, err)
	}
}

func TestGetReportsExpiredAndStoresIt(t *testing.T) {
	e := setup()
	a := e.create(t)
	e.clk.Advance(approvals.TTL)
	v, err := e.s.Get(context.Background(), newPhone, a.ID)
	if err != nil || v.Status != approvals.Expired || v.Keys != nil {
		t.Fatalf("%+v %v", v, err)
	}
	if e.repo.rows[a.ID].Status != approvals.Expired {
		t.Fatal("not stored as expired")
	}
}

func TestGrantIsReturnedOnceThenCleared(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := e.create(t)
	if _, err := e.s.Approve(ctx, oldPhone, a.ID, grant); err != nil {
		t.Fatal(err)
	}
	e.rec.events = nil
	// The new device is active now; it may still read its own request.
	v, err := e.s.Get(ctx, newPhone, a.ID)
	if err != nil || v.Status != approvals.Approved || v.Keys == nil ||
		!bytes.Equal(v.Keys.WrappedDEK, grant.WrappedDEK) || !bytes.Equal(v.Keys.EphemeralPublicKey, grant.EphemeralPublicKey) || !bytes.Equal(v.Keys.Nonce, grant.Nonce) {
		t.Fatalf("first read: %+v %v", v, err)
	}
	stored := e.repo.rows[a.ID]
	if stored.Grant.WrappedDEK != nil || stored.Grant.EphemeralPublicKey != nil || stored.Grant.Nonce != nil {
		t.Fatalf("grant not cleared: %+v", stored.Grant)
	}
	if len(e.rec.events) != 1 {
		t.Fatalf("events %+v", e.rec.events)
	}
	ev := e.rec.events[0]
	if ev.Type != audit.BackupRestored || ev.DeviceID != "new" || len(ev.Meta) != 1 || ev.Meta["method"] != "device_approval" {
		t.Fatalf("event %+v", ev)
	}
	v, err = e.s.Get(ctx, newPhone, a.ID)
	if err != nil || v.Status != approvals.Approved || v.Keys != nil || len(e.rec.events) != 1 {
		t.Fatalf("second read: %+v %v events=%d", v, err, len(e.rec.events))
	}
}

func TestNoKeyMaterialInAuditOrErrors(t *testing.T) {
	e := setup()
	ctx := context.Background()
	a := e.create(t)
	_, _ = e.s.Approve(ctx, oldPhone, a.ID, grant)
	_, _ = e.s.Get(ctx, newPhone, a.ID)
	secrets := [][]byte{grant.WrappedDEK, grant.EphemeralPublicKey, grant.Nonce, pubKey}
	for _, ev := range e.rec.events {
		text := fmt.Sprintf("%+v", ev)
		for _, s := range secrets {
			if strings.Contains(text, string(s)) || strings.Contains(text, fmt.Sprintf("%v", s)) {
				t.Fatalf("event leaks key material: %s", text)
			}
		}
	}
}
