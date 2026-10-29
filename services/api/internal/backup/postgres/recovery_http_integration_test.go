//go:build integration

package postgres_test

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

type recAudit struct{ types []string }

func (r *recAudit) Record(_ context.Context, e audit.Event) error {
	r.types = append(r.types, e.Type)
	return nil
}

// TestRecoveryActivationOverHTTP mounts the real identity and backup modules over a real pool
// and activates a real pending device with the recovery proof.
func TestRecoveryActivationOverHTTP(t *testing.T) {
	pool := setup(t)
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	rec := &recAudit{}
	d := module.Deps{DB: pool, Clock: clock.System{}, Audit: rec}
	r := chi.NewRouter()
	r.Route("/v1", func(r chi.Router) { identity.New(d).Routes(r); backup.New(d).Routes(r) })

	call := func(method, path, body, deviceID string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+auth.DevToken)
		req.Header.Set("Content-Type", "application/json")
		if deviceID != "" {
			req.Header.Set("X-Device-Id", deviceID)
		}
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w
	}
	b64 := func(n int, b byte) string { return base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{b}, n)) }
	register := func(b byte) (id, status string) {
		w := call("POST", "/v1/devices", `{"name":"Phone","platform":"android","publicKey":"`+b64(32, b)+`"}`, "")
		var dev struct{ ID, Status string }
		_ = json.Unmarshal(w.Body.Bytes(), &dev)
		if w.Code != 201 {
			t.Fatalf("register: %d %s", w.Code, w.Body)
		}
		return dev.ID, dev.Status
	}
	active, st := register(1)
	pending, st2 := register(2)
	if st != "active" || st2 != "pending" {
		t.Fatalf("statuses %s %s", st, st2)
	}

	proof := bytes.Repeat([]byte{7}, 32)
	sum := sha256.Sum256(proof)
	hash := sum[:]
	put := `{"wrappedDek":"` + b64(48, 1) + `","nonce":"` + b64(12, 2) + `","salt":"` + b64(16, 3) + `","kdf":"argon2id",` +
		`"kdfParams":{"memoryKiB":65536,"iterations":3,"parallelism":1},"deviceProofHash":"` + base64.StdEncoding.EncodeToString(hash) + `"}`
	activate := func(p []byte) *httptest.ResponseRecorder {
		return call("POST", "/v1/backup/recovery-key/activate", `{"deviceProof":"`+base64.StdEncoding.EncodeToString(p)+`"}`, pending)
	}

	if w := call("PUT", "/v1/backup/recovery-key", put, pending); w.Code != http.StatusForbidden {
		t.Fatalf("pending PUT: %d %s", w.Code, w.Body)
	}
	if w := activate(proof); w.Code != 404 {
		t.Fatalf("no key yet: %d %s", w.Code, w.Body)
	}
	if w := call("PUT", "/v1/backup/recovery-key", put, active); w.Code != 204 {
		t.Fatalf("PUT: %d %s", w.Code, w.Body)
	}
	if w := call("GET", "/v1/backup/recovery-key", "", pending); w.Code != 200 || strings.Contains(w.Body.String(), base64.StdEncoding.EncodeToString(hash)) {
		t.Fatalf("GET by pending device: %d %s", w.Code, w.Body)
	}
	if w := activate(bytes.Repeat([]byte{8}, 32)); w.Code != 422 {
		t.Fatalf("wrong proof: %d %s", w.Code, w.Body)
	}
	if w := activate(proof); w.Code != 204 {
		t.Fatalf("activate: %d %s", w.Code, w.Body)
	}
	// The device is now really active in identity.devices: it may replace the key.
	if w := call("PUT", "/v1/backup/recovery-key", put, pending); w.Code != 204 {
		t.Fatalf("activated device PUT: %d %s", w.Code, w.Body)
	}
	if w := activate(proof); w.Code != 204 {
		t.Fatalf("already active: %d %s", w.Code, w.Body)
	}
	want := []string{audit.DeviceRegistered, audit.DeviceRegistered, audit.RecoveryKeySet, audit.DeviceApproved, audit.BackupRestored, audit.RecoveryKeySet}
	if strings.Join(rec.types, ",") != strings.Join(want, ",") {
		t.Fatalf("audit %v, want %v", rec.types, want)
	}
}
