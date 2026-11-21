package backup

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/records"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

const recID = "7d9c1b2e-4f3a-4e8b-a1c5-0b6d8e2f3a41"

type fakeRecords struct {
	putErr, listErr error
	got             []records.Envelope
	gotCursor       string
	gotLimit        int
	puts            int
	page            records.Page
}

func (f *fakeRecords) Put(_ context.Context, _ auth.User, b []records.Envelope) (int, error) {
	f.puts, f.got = f.puts+1, b
	return len(b), f.putErr
}
func (f *fakeRecords) List(_ context.Context, _ auth.User, c string, l int) (records.Page, error) {
	f.gotCursor, f.gotLimit = c, l
	return f.page, f.listErr
}

func serveRecords(t *testing.T, f *fakeRecords) http.Handler {
	t.Helper()
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	m := New(module.Deps{}).(mod)
	m.records = f
	r := chi.NewRouter()
	r.Route("/v1", m.Routes)
	return r
}

func envJSON(mut func(map[string]any)) map[string]any {
	m := map[string]any{"collection": "savings.goals", "recordId": recID, "version": 3, "deleted": false,
		"nonce": b64(12, 1), "ciphertext": b64(32, 9)}
	if mut != nil {
		mut(m)
	}
	return m
}

func upload(envs ...map[string]any) string {
	b, _ := json.Marshal(map[string]any{"records": envs})
	return string(b)
}

func TestPutRecords(t *testing.T) {
	f := &fakeRecords{}
	h := serveRecords(t, f)
	rec := do(h, "PUT", "/v1/backup/records", upload(envJSON(nil)))
	if rec.Code != 200 || strings.TrimSpace(rec.Body.String()) != `{"accepted":1}` {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if len(f.got) != 1 || f.got[0].RecordID != recID || len(f.got[0].Nonce) != 12 || len(f.got[0].Ciphertext) != 32 || f.got[0].Version != 3 {
		t.Fatalf("service got %+v", f.got)
	}
}

func TestPutRecordsInvalid(t *testing.T) {
	f := &fakeRecords{}
	h := serveRecords(t, f)
	many := make([]map[string]any, 201)
	for i := range many {
		many[i] = envJSON(nil)
	}
	cases := map[string]string{
		"collection upper": upload(envJSON(func(m map[string]any) { m["collection"] = "Savings.goals" })),
		"collection long":  upload(envJSON(func(m map[string]any) { m["collection"] = strings.Repeat("a", 33) + "." + strings.Repeat("b", 32) })),
		"collection dot":   upload(envJSON(func(m map[string]any) { m["collection"] = "savings" })),
		"version zero":     upload(envJSON(func(m map[string]any) { m["version"] = 0 })),
		"nonce 11":         upload(envJSON(func(m map[string]any) { m["nonce"] = b64(11, 1) })),
		"nonce not base64": upload(envJSON(func(m map[string]any) { m["nonce"] = "not base64 !!!" })),
		"ciphertext tiny":  upload(envJSON(func(m map[string]any) { m["ciphertext"] = b64(15, 9) })),
		"ciphertext huge":  upload(envJSON(func(m map[string]any) { m["ciphertext"] = b64(65537, 9) })),
		"ciphertext url64": upload(envJSON(func(m map[string]any) { m["ciphertext"] = strings.Repeat("_-", 12) })),
		"empty batch":      `{"records":[]}`,
		"too many":         upload(many...),
		"duplicate":        upload(envJSON(nil), envJSON(func(m map[string]any) { m["version"] = 4 })),
		"bad uuid":         upload(envJSON(func(m map[string]any) { m["recordId"] = "nope" })),
		"not json":         `{`,
	}
	for name, body := range cases {
		rec := do(h, "PUT", "/v1/backup/records", body)
		if f.puts != 0 {
			t.Fatalf("%s reached the service", name)
		}
		if name == "bad uuid" || name == "not json" {
			wantProblem(t, rec, 400, "bad_request")
			continue
		}
		wantProblem(t, rec, 400, "invalid_request")
		for _, leak := range []string{recID, b64(12, 1), b64(32, 9), "Savings"} {
			if strings.Contains(rec.Body.String(), leak) {
				t.Fatalf("%s leaks request data: %s", name, rec.Body)
			}
		}
	}
	rec := do(h, "PUT", "/v1/backup/records", upload(envJSON(nil), envJSON(func(m map[string]any) { m["ciphertext"] = "x" })))
	if !strings.Contains(rec.Body.String(), "records[1].ciphertext") {
		t.Fatalf("detail does not name the field: %s", rec.Body)
	}
}

func TestPutRecordsProblems(t *testing.T) {
	f := &fakeRecords{}
	h := serveRecords(t, f)
	for err, want := range map[error][2]any{
		records.ErrNotActive: {403, "device_not_active"},
		records.ErrStale:     {409, "stale_version"},
		records.ErrQuota:     {413, "quota_exceeded"},
	} {
		f.putErr = err
		wantProblem(t, do(h, "PUT", "/v1/backup/records", upload(envJSON(nil))), want[0].(int), want[1].(string))
	}
	f.putErr = errors.New("db down with secret " + b64(32, 9))
	wantProblem(t, do(h, "PUT", "/v1/backup/records", upload(envJSON(nil))), 500, "internal")
}

func TestPutRecordsBodyLimit(t *testing.T) {
	f := &fakeRecords{}
	h := serveRecords(t, f)
	big := `{"records":[],"pad":"` + strings.Repeat("a", records.MaxBodyBytes) + `"}`
	wantProblem(t, do(h, "PUT", "/v1/backup/records", big), 413, "quota_exceeded")
	if f.puts != 0 {
		t.Fatal("an oversized body reached the service")
	}
}

func TestGetRecords(t *testing.T) {
	next := "Mg"
	f := &fakeRecords{page: records.Page{Next: next, Records: []records.Stored{{
		Envelope: records.Envelope{Collection: "savings.goals", RecordID: recID, Version: 3, Deleted: true,
			Nonce: make([]byte, 12), Ciphertext: make([]byte, 16)},
		Seq: 2, UpdatedAt: time.Date(2026, 10, 28, 1, 2, 3, 0, time.UTC)}}}}
	h := serveRecords(t, f)
	rec := do(h, "GET", "/v1/backup/records?updatedAfter=MQ&limit=2", "")
	var out struct {
		Records    []map[string]any `json:"records"`
		NextCursor *string          `json:"nextCursor"`
	}
	if rec.Code != 200 || json.Unmarshal(rec.Body.Bytes(), &out) != nil || len(out.Records) != 1 || out.NextCursor == nil || *out.NextCursor != next {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	r := out.Records[0]
	if r["recordId"] != recID || r["deleted"] != true || r["updatedAt"] != "2026-10-28T01:02:03Z" || r["collection"] != "savings.goals" || r["version"] != float64(3) {
		t.Fatalf("record %v", r)
	}
	if strings.Contains(rec.Body.String(), "seq") || f.gotCursor != "MQ" || f.gotLimit != 2 {
		t.Fatalf("seq leaked or params lost: %s %q %d", rec.Body, f.gotCursor, f.gotLimit)
	}
	f.page = records.Page{}
	rec = do(h, "GET", "/v1/backup/records", "")
	if rec.Code != 200 || f.gotLimit != 200 || f.gotCursor != "" || !strings.Contains(rec.Body.String(), `"records":[]`) || !strings.Contains(rec.Body.String(), `"nextCursor":null`) {
		t.Fatalf("%d %s limit %d", rec.Code, rec.Body, f.gotLimit)
	}
}

func TestGetRecordsProblems(t *testing.T) {
	f := &fakeRecords{}
	h := serveRecords(t, f)
	for _, q := range []string{"limit=0", "limit=501", "updatedAfter=" + strings.Repeat("a", 129)} {
		wantProblem(t, do(h, "GET", "/v1/backup/records?"+q, ""), 400, "invalid_request")
	}
	f.listErr = records.ErrBadCursor
	wantProblem(t, do(h, "GET", "/v1/backup/records?updatedAfter=zz", ""), 400, "invalid_request")
	f.listErr = records.ErrNotActive
	wantProblem(t, do(h, "GET", "/v1/backup/records", ""), 403, "device_not_active")
	f.listErr = errors.New("db down")
	wantProblem(t, do(h, "GET", "/v1/backup/records", ""), 500, "internal")
}
