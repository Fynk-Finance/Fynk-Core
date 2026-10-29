//go:build integration

package postgres_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

type approvalsAPI struct {
	*recordsAPI
	clk  *clock.Fixed
	rec  *recAudit
	pool module.Deps
}

// newApprovalsAPI mounts the real identity and backup modules on a fixed clock and registers an
// active device (public key bytes of 1) and a pending one (bytes of 2) for the dev user.
func newApprovalsAPI(t *testing.T) *approvalsAPI {
	pool := setup(t)
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	a := &approvalsAPI{clk: clock.NewFixed(time.Now().UTC().Truncate(time.Second)), rec: &recAudit{}}
	a.pool = module.Deps{DB: pool, Clock: a.clk, Audit: a.rec}
	r := chi.NewRouter()
	r.Route("/v1", func(r chi.Router) { identity.New(a.pool).Routes(r); backup.New(a.pool).Routes(r) })
	a.recordsAPI = &recordsAPI{t: t, h: r}
	reg := func(b byte) string {
		pk := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{b}, 32))
		w := a.call("POST", "/v1/devices", `{"name":"Phone `+string(rune('0'+b))+`","platform":"android","publicKey":"`+pk+`"}`, "")
		var dev struct{ ID string }
		_ = json.Unmarshal(w.Body.Bytes(), &dev)
		if w.Code != 201 {
			t.Fatalf("register: %d %s", w.Code, w.Body)
		}
		return dev.ID
	}
	a.active, a.pending = reg(1), reg(2)
	return a
}

func (a *approvalsAPI) create(device, key string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("POST", "/v1/device-approvals", nil)
	req.Header.Set("Authorization", "Bearer "+auth.DevToken)
	req.Header.Set("X-Device-Id", device)
	if key != "" {
		req.Header.Set("Idempotency-Key", key)
	}
	w := httptest.NewRecorder()
	a.h.ServeHTTP(w, req)
	return w
}

type approvalJSON struct {
	ID                 string `json:"id"`
	Status             string `json:"status"`
	ExpiresAt          string `json:"expiresAt"`
	EphemeralPublicKey string `json:"ephemeralPublicKey"`
	WrappedDek         string `json:"wrappedDek"`
	Nonce              string `json:"nonce"`
}

func (a *approvalsAPI) created(device, key string) approvalJSON {
	a.t.Helper()
	w := a.create(device, key)
	var out approvalJSON
	if w.Code != http.StatusCreated || json.Unmarshal(w.Body.Bytes(), &out) != nil || out.Status != "pending" {
		a.t.Fatalf("create: %d %s", w.Code, w.Body)
	}
	return out
}

func (a *approvalsAPI) read(device, id string) approvalJSON {
	a.t.Helper()
	w := a.call("GET", "/v1/device-approvals/"+id, "", device)
	var out approvalJSON
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &out) != nil {
		a.t.Fatalf("get: %d %s", w.Code, w.Body)
	}
	return out
}

func (a *approvalsAPI) status(method, path, body, device string, want int) {
	a.t.Helper()
	if w := a.call(method, path, body, device); w.Code != want {
		a.t.Fatalf("%s %s: %d, want %d: %s", method, path, w.Code, want, w.Body)
	}
}

func std(n int, b byte) string { return base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{b}, n)) }

func grantJSON() string {
	return `{"ephemeralPublicKey":"` + std(32, 5) + `","wrappedDek":"` + std(48, 6) + `","nonce":"` + std(12, 7) + `"}`
}

func (a *approvalsAPI) keyColumns() int {
	var n int
	err := a.pool.DB.QueryRow(context.Background(), `SELECT count(*) FROM backup.device_approvals
		WHERE ephemeral_public_key IS NOT NULL OR wrapped_dek IS NOT NULL OR nonce IS NOT NULL`).Scan(&n)
	if err != nil {
		a.t.Fatal(err)
	}
	return n
}

func TestDeviceApprovalApproveFlow(t *testing.T) {
	a := newApprovalsAPI(t)
	base := "/v1/device-approvals"
	a.status("GET", base+"/pending", "", a.pending, 403) // a pending device cannot list

	first := a.created(a.pending, "retry-1")
	if again := a.created(a.pending, "retry-1"); again.ID != first.ID {
		t.Fatalf("idempotent create returned %s, want %s", again.ID, first.ID)
	}
	if w := a.create(a.active, ""); w.Code != 409 || !strings.Contains(w.Body.String(), "device_already_active") {
		t.Fatalf("active device create: %d %s", w.Code, w.Body)
	}
	// A request without a key replaces the open one: a device has at most one.
	open := a.created(a.pending, "")
	if open.ID == first.ID {
		t.Fatal("a new request reused the old id")
	}
	if got := a.read(a.pending, first.ID); got.Status != "expired" {
		t.Fatalf("older request is %s, want expired", got.Status)
	}

	var list struct {
		Approvals []struct {
			ID, DeviceName, Platform, NewDevicePublicKey string
		}
	}
	w := a.call("GET", base+"/pending", "", a.active)
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &list) != nil || len(list.Approvals) != 1 {
		t.Fatalf("list: %d %s", w.Code, w.Body)
	}
	if l := list.Approvals[0]; l.ID != open.ID || l.DeviceName != "Phone 2" || l.Platform != "android" || l.NewDevicePublicKey != std(32, 2) {
		t.Fatalf("listed %+v", l)
	}

	// Only the creating device reads the request; the pending one sees no key fields yet.
	a.status("GET", base+"/"+open.ID, "", a.active, 404)
	if got := a.read(a.pending, open.ID); got.Status != "pending" || got.WrappedDek != "" {
		t.Fatalf("pending read: %+v", got)
	}
	a.status("POST", base+"/"+open.ID+"/approve", `{"ephemeralPublicKey":"`+std(31, 5)+`","wrappedDek":"`+std(48, 6)+`","nonce":"`+std(12, 7)+`"}`, a.active, 400)
	a.status("POST", base+"/"+open.ID+"/approve", grantJSON(), a.pending, 403)
	a.status("POST", base+"/00000000-0000-4000-8000-000000000000/approve", grantJSON(), a.active, 404)
	a.status("POST", base+"/"+open.ID+"/approve", grantJSON(), a.active, 200)
	a.status("POST", base+"/"+open.ID+"/approve", grantJSON(), a.active, 409)
	a.status("POST", base+"/"+open.ID+"/reject", "", a.active, 409)

	// The new device is active in identity: it can use the records API now.
	b, _ := json.Marshal(map[string]any{"records": []map[string]any{envelope(uid(1), 1, bytes.Repeat([]byte{1}, 12), bytes.Repeat([]byte{2}, 32))}})
	a.status("PUT", "/v1/backup/records", string(b), a.pending, 200)

	got := a.read(a.pending, open.ID)
	if got.Status != "approved" || got.EphemeralPublicKey != std(32, 5) || got.WrappedDek != std(48, 6) || got.Nonce != std(12, 7) {
		t.Fatalf("first read: %+v", got)
	}
	if again := a.read(a.pending, open.ID); again.Status != "approved" || again.EphemeralPublicKey != "" || again.WrappedDek != "" || again.Nonce != "" {
		t.Fatalf("second read still has keys: %+v", again)
	}
	if n := a.keyColumns(); n != 0 {
		t.Fatalf("%d approvals still hold key columns", n)
	}
	want := []string{audit.DeviceRegistered, audit.DeviceRegistered, audit.DeviceApproved, audit.BackupUploaded, audit.BackupRestored}
	if strings.Join(a.rec.types, ",") != strings.Join(want, ",") {
		t.Fatalf("audit %v, want %v", a.rec.types, want)
	}
}

func TestDeviceApprovalRejectFlow(t *testing.T) {
	a := newApprovalsAPI(t)
	base := "/v1/device-approvals"
	ap := a.created(a.pending, "")
	a.status("POST", base+"/"+ap.ID+"/reject", "", a.pending, 403)
	a.status("POST", base+"/"+ap.ID+"/reject", "", a.active, 200)
	if got := a.read(a.pending, ap.ID); got.Status != "rejected" || got.WrappedDek != "" {
		t.Fatalf("after reject: %+v", got)
	}
	a.status("POST", base+"/"+ap.ID+"/approve", grantJSON(), a.active, 409)
	a.status("POST", base+"/"+ap.ID+"/reject", "", a.active, 409)
	// The device stays pending: it cannot use the backup, and its list is empty.
	b, _ := json.Marshal(map[string]any{"records": []map[string]any{envelope(uid(1), 1, bytes.Repeat([]byte{1}, 12), bytes.Repeat([]byte{2}, 32))}})
	a.status("PUT", "/v1/backup/records", string(b), a.pending, 403)
	if w := a.call("GET", base+"/pending", "", a.active); !strings.Contains(w.Body.String(), `"approvals":[]`) {
		t.Fatalf("list after reject: %s", w.Body)
	}
	want := []string{audit.DeviceRegistered, audit.DeviceRegistered, audit.DeviceRejected}
	if strings.Join(a.rec.types, ",") != strings.Join(want, ",") {
		t.Fatalf("audit %v, want %v", a.rec.types, want)
	}
}

func TestDeviceApprovalExpires(t *testing.T) {
	a := newApprovalsAPI(t)
	base := "/v1/device-approvals"
	ap := a.created(a.pending, "")
	a.clk.Advance(9*time.Minute + 59*time.Second)
	if w := a.call("GET", base+"/pending", "", a.active); !strings.Contains(w.Body.String(), ap.ID) {
		t.Fatalf("still open request not listed: %s", w.Body)
	}
	a.clk.Advance(time.Second) // exactly 10 minutes
	if w := a.call("GET", base+"/pending", "", a.active); !strings.Contains(w.Body.String(), `"approvals":[]`) {
		t.Fatalf("expired request listed: %s", w.Body)
	}
	if w := a.call("POST", base+"/"+ap.ID+"/approve", grantJSON(), a.active); w.Code != 410 || !strings.Contains(w.Body.String(), "approval_expired") {
		t.Fatalf("approve expired: %d %s", w.Code, w.Body)
	}
	a.status("POST", base+"/"+ap.ID+"/reject", "", a.active, 410)
	if got := a.read(a.pending, ap.ID); got.Status != "expired" {
		t.Fatalf("read: %+v", got)
	}
	if n := a.keyColumns(); n != 0 {
		t.Fatalf("%d approvals hold keys", n)
	}
	// Expired for good: the device may ask again and gets a fresh 10 minutes.
	fresh := a.created(a.pending, "")
	if fresh.ID == ap.ID {
		t.Fatal("expired id reused")
	}
	a.status("POST", base+"/"+fresh.ID+"/approve", grantJSON(), a.active, 200)
}
