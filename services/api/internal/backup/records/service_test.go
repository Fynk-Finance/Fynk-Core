package records_test

import (
	"bytes"
	"context"
	"errors"
	"testing"
	"time"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/records"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

var now = time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)

// memRepo keeps records in memory; InTx works on a copy that is dropped on error.
type memRepo struct {
	rows map[string]records.Stored
	seq  int64
}

func newRepo() *memRepo { return &memRepo{rows: map[string]records.Stored{}} }

type memTx struct{ r *memRepo }

func (t memTx) Upsert(_ context.Context, _ string, e records.Envelope, at time.Time) (bool, error) {
	k := e.Collection + "/" + e.RecordID
	if old, ok := t.r.rows[k]; ok && old.Version > e.Version {
		return false, nil
	}
	t.r.seq++
	t.r.rows[k] = records.Stored{Envelope: e, Seq: t.r.seq, UpdatedAt: at}
	return true, nil
}

func (t memTx) Usage(context.Context, string) (int64, error) {
	var n int64
	for _, s := range t.r.rows {
		n += int64(len(s.Ciphertext) + len(s.Nonce))
	}
	return n, nil
}

func (r *memRepo) InTx(_ context.Context, _ string, fn func(records.Tx) error) error {
	saved, seq := make(map[string]records.Stored, len(r.rows)), r.seq
	for k, v := range r.rows {
		saved[k] = v
	}
	if err := fn(memTx{r}); err != nil {
		r.rows, r.seq = saved, seq
		return err
	}
	return nil
}

func (r *memRepo) After(_ context.Context, _ string, after int64, limit int) ([]records.Stored, error) {
	var out []records.Stored
	for s := int64(1); s <= r.seq && len(out) < limit; s++ {
		for _, v := range r.rows {
			if v.Seq == s && s > after {
				out = append(out, v)
			}
		}
	}
	return out, nil
}

type fakeDevices struct {
	status string
	err    error
}

func (f *fakeDevices) Get(context.Context, string, string) (identity.DeviceInfo, error) {
	return identity.DeviceInfo{Status: f.status}, f.err
}
func (*fakeDevices) RemoveOthers(context.Context, string, string) error { return nil }

type fakeAudit struct{ events []audit.Event }

func (f *fakeAudit) Record(_ context.Context, e audit.Event) error {
	f.events = append(f.events, e)
	return nil
}

var user = auth.User{ID: "u1", DeviceID: "dev"}

func setup(status string) (*records.Service, *memRepo, *fakeAudit) {
	repo, rec := newRepo(), &fakeAudit{}
	return records.NewService(repo, &fakeDevices{status: status}, clock.NewFixed(now), rec), repo, rec
}

func env(id string, version int64, size int) records.Envelope {
	return records.Envelope{Collection: "savings.goals", RecordID: "7d9c1b2e-4f3a-4e8b-a1c5-0b6d8e2f3a4" + id,
		Version: version, Nonce: bytes.Repeat([]byte{1}, 12), Ciphertext: bytes.Repeat([]byte{byte(version)}, size)}
}

func TestOnlyActiveDeviceMayPutAndList(t *testing.T) {
	for name, d := range map[string]*fakeDevices{
		"pending": {status: "pending"}, "unknown": {err: identity.ErrNotFound}, "removed": {err: identity.ErrRemoved},
	} {
		repo, rec := newRepo(), &fakeAudit{}
		s := records.NewService(repo, d, clock.NewFixed(now), rec)
		if _, err := s.Put(context.Background(), user, []records.Envelope{env("1", 1, 32)}); !errors.Is(err, records.ErrNotActive) {
			t.Fatalf("%s put: %v", name, err)
		}
		if _, err := s.List(context.Background(), user, "", 10); !errors.Is(err, records.ErrNotActive) {
			t.Fatalf("%s list: %v", name, err)
		}
		if len(repo.rows) != 0 || len(rec.events) != 0 {
			t.Fatalf("%s: stored %d rows, %d events", name, len(repo.rows), len(rec.events))
		}
	}
	s, _, _ := setup("active")
	if _, err := s.Put(context.Background(), auth.User{ID: "u1"}, []records.Envelope{env("1", 1, 32)}); !errors.Is(err, records.ErrNotActive) {
		t.Fatalf("no device: %v", err)
	}
}

func TestStaleVersionRejectsTheWholeBatch(t *testing.T) {
	s, repo, rec := setup("active")
	ctx := context.Background()
	if _, err := s.Put(ctx, user, []records.Envelope{env("1", 5, 32)}); err != nil {
		t.Fatal(err)
	}
	_, err := s.Put(ctx, user, []records.Envelope{env("2", 1, 32), env("1", 4, 32)})
	if !errors.Is(err, records.ErrStale) {
		t.Fatalf("got %v", err)
	}
	if len(repo.rows) != 1 || repo.rows["savings.goals/7d9c1b2e-4f3a-4e8b-a1c5-0b6d8e2f3a41"].Version != 5 {
		t.Fatalf("batch not atomic: %+v", repo.rows)
	}
	if len(rec.events) != 1 {
		t.Fatalf("a rejected batch was audited: %d events", len(rec.events))
	}
}

func TestEqualVersionOverwrites(t *testing.T) {
	s, repo, _ := setup("active")
	ctx := context.Background()
	a, b := env("1", 3, 32), env("1", 3, 48)
	for _, e := range []records.Envelope{a, b} {
		if _, err := s.Put(ctx, user, []records.Envelope{e}); err != nil {
			t.Fatal(err)
		}
	}
	got := repo.rows["savings.goals/"+a.RecordID]
	if len(got.Ciphertext) != 48 || got.Seq != 2 {
		t.Fatalf("not overwritten: %d bytes, seq %d", len(got.Ciphertext), got.Seq)
	}
}

func TestQuotaExceededRollsBack(t *testing.T) {
	s, repo, rec := setup("active")
	ctx := context.Background()
	if _, err := s.Put(ctx, user, []records.Envelope{env("1", 1, records.MaxCiphertext)}); err != nil {
		t.Fatal(err)
	}
	var batch []records.Envelope
	for i := 0; i < 80; i++ {
		e := env("2", 1, records.MaxCiphertext)
		e.RecordID = "00000000-0000-4000-8000-0000000000" + string(rune('0'+i/10)) + string(rune('0'+i%10))
		batch = append(batch, e)
	}
	if _, err := s.Put(ctx, user, batch); !errors.Is(err, records.ErrQuota) {
		t.Fatalf("got %v", err)
	}
	if len(repo.rows) != 1 || len(rec.events) != 1 {
		t.Fatalf("quota failure stored %d rows, %d events", len(repo.rows), len(rec.events))
	}
}

func TestAuditHasOnlyTheCount(t *testing.T) {
	s, _, rec := setup("active")
	n, err := s.Put(context.Background(), user, []records.Envelope{env("1", 1, 32), env("2", 1, 32)})
	if err != nil || n != 2 || len(rec.events) != 1 {
		t.Fatalf("%d %v %d", n, err, len(rec.events))
	}
	e := rec.events[0]
	if e.Type != audit.BackupUploaded || len(e.Meta) != 1 || e.Meta["count"] != "2" || e.UserID != "u1" || e.DeviceID != "dev" {
		t.Fatalf("event %+v", e)
	}
}

func TestListPagesAndCursor(t *testing.T) {
	s, _, _ := setup("active")
	ctx := context.Background()
	if _, err := s.Put(ctx, user, []records.Envelope{env("1", 1, 32), env("2", 1, 32), env("3", 1, 32)}); err != nil {
		t.Fatal(err)
	}
	p, err := s.List(ctx, user, "", 2)
	if err != nil || len(p.Records) != 2 || p.Next == "" {
		t.Fatalf("%+v %v", p, err)
	}
	p, err = s.List(ctx, user, p.Next, 2)
	if err != nil || len(p.Records) != 1 || p.Next != "" {
		t.Fatalf("%+v %v", p, err)
	}
	for _, c := range []string{"!!", "LTE", "MDE", "YWJj"} { // not base64, -1, "01", "abc"
		if _, err := s.List(ctx, user, c, 2); !errors.Is(err, records.ErrBadCursor) {
			t.Fatalf("cursor %q: %v", c, err)
		}
	}
}
