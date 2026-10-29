//go:build integration

package postgres_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
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

// fakeKeycloak answers the admin calls the reset makes: the user attributes (the email reset
// time), the user's sessions and the session revocations.
type fakeKeycloak struct {
	mu       sync.Mutex
	resetAt  time.Time // zero means the person never reset by email code
	sessions map[string]time.Time
	revoked  []string
}

func (k *fakeKeycloak) handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		k.mu.Lock()
		defer k.mu.Unlock()
		const admin = "/admin/realms/fynk"
		switch {
		case r.URL.Path == "/realms/fynk/protocol/openid-connect/token":
			_, _ = w.Write([]byte(`{"access_token":"tok","expires_in":300}`))
		case r.Method == http.MethodGet && r.URL.Path == admin+"/users/dev-user":
			attrs := map[string][]string{}
			if !k.resetAt.IsZero() {
				attrs["fynkEmailResetAt"] = []string{strconv.FormatInt(k.resetAt.UnixMilli(), 10)}
			}
			_ = json.NewEncoder(w).Encode(map[string]any{"attributes": attrs})
		case r.Method == http.MethodGet && r.URL.Path == admin+"/users/dev-user/sessions":
			out := []map[string]any{}
			for sid, at := range k.sessions {
				out = append(out, map[string]any{"id": sid, "start": at.UnixMilli()})
			}
			_ = json.NewEncoder(w).Encode(out)
		case r.Method == http.MethodDelete && strings.HasPrefix(r.URL.Path, admin+"/sessions/"):
			k.revoked = append(k.revoked, strings.TrimPrefix(r.URL.Path, admin+"/sessions/"))
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	})
}

// sidVerifier accepts the dev token like auth.DevVerifier and adds a Keycloak session id: the one
// of the device that calls, or regSID when no device is given (registration).
type sidVerifier struct {
	regSID string
	sids   map[string]string
}

func (v *sidVerifier) Verify(_ context.Context, token, deviceID string) (auth.User, error) {
	if token != auth.DevToken {
		return auth.User{}, auth.ErrInvalidToken
	}
	sid := v.regSID
	if deviceID != "" {
		sid = v.sids[deviceID]
	}
	return auth.User{ID: "dev-user", EmailVerified: true, DeviceID: deviceID, SessionID: sid}, nil
}

type resetAPI struct {
	*recordsAPI
	clk    *clock.Fixed
	rec    *recAudit
	kc     *fakeKeycloak
	pool   module.Deps
	oldSID string
	newSID string
}

// newResetAPI mounts the real identity and backup modules over the real pool, with a fake
// Keycloak. The dev user has an active old phone (session sid-old) and a pending new phone
// (session sid-new).
func newResetAPI(t *testing.T) *resetAPI {
	pool := setup(t)
	clk := clock.NewFixed(time.Now().UTC().Truncate(time.Second))
	kc := &fakeKeycloak{sessions: map[string]time.Time{}}
	srv := httptest.NewServer(kc.handler())
	t.Cleanup(srv.Close)
	v := &sidVerifier{sids: map[string]string{}}
	auth.Install(v)
	t.Cleanup(func() { auth.Install(nil) })
	rec := &recAudit{}
	d := module.Deps{DB: pool, Clock: clk, Audit: rec, Config: config.Config{
		KeycloakURL: srv.URL, KeycloakRealm: "fynk", KeycloakAdminClientSecret: "s"}}
	r := chi.NewRouter()
	r.Route("/v1", func(r chi.Router) { identity.New(d).Routes(r); backup.New(d).Routes(r) })
	a := &resetAPI{recordsAPI: &recordsAPI{t: t, h: r}, clk: clk, rec: rec, kc: kc, pool: d, oldSID: "sid-old", newSID: "sid-new"}
	reg := func(b byte, sid string) string {
		v.regSID = sid
		pk := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{b}, 32))
		w := a.call("POST", "/v1/devices", `{"name":"Phone","platform":"android","publicKey":"`+pk+`"}`, "")
		var dev struct{ ID string }
		_ = json.Unmarshal(w.Body.Bytes(), &dev)
		if w.Code != 201 {
			t.Fatalf("register: %d %s", w.Code, w.Body)
		}
		v.sids[dev.ID] = sid
		return dev.ID
	}
	a.active, a.pending = reg(1, a.oldSID), reg(2, a.newSID)
	kc.sessions[a.oldSID] = clk.Now().Add(-48 * time.Hour)
	kc.sessions[a.newSID] = clk.Now().Add(-time.Minute)
	return a
}

// seed gives the dev user records, a recovery key and an open approval, and another user a record.
func (a *resetAPI) seed() {
	a.t.Helper()
	nonce, ct := bytes.Repeat([]byte{1}, 12), bytes.Repeat([]byte{2}, 32)
	b, _ := json.Marshal(map[string]any{"records": []any{
		envelope("11111111-1111-4111-8111-111111111111", 1, nonce, ct),
		envelope("22222222-2222-4222-8222-222222222222", 1, nonce, ct)}})
	key := `{"wrappedDek":"` + std(48, 1) + `","nonce":"` + std(12, 2) + `","salt":"` + std(16, 3) + `","kdf":"argon2id",` +
		`"kdfParams":{"memoryKiB":65536,"iterations":3,"parallelism":1},"deviceProofHash":"` + std(32, 5) + `"}`
	a.status("PUT", "/v1/backup/records", string(b), a.active, 200)
	a.status("PUT", "/v1/backup/recovery-key", key, a.active, 204)
	a.status("POST", "/v1/device-approvals", "", a.pending, 201)
	_, err := a.pool.DB.Exec(context.Background(), `INSERT INTO backup.records
		(user_id, collection, record_id, version, deleted, nonce, ciphertext, updated_at, seq)
		VALUES ('other-user', 'savings.goals', '33333333-3333-4333-8333-333333333333', 1, false, $1, $2, now(), nextval('backup.records_seq'))`,
		nonce, ct)
	if err != nil {
		a.t.Fatal(err)
	}
}

func (a *resetAPI) status(method, path, body, device string, want int) {
	a.t.Helper()
	if w := a.call(method, path, body, device); w.Code != want {
		a.t.Fatalf("%s %s: %d, want %d: %s", method, path, w.Code, want, w.Body)
	}
}

func (a *resetAPI) count(query string, args ...any) int {
	a.t.Helper()
	var n int
	if err := a.pool.DB.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		a.t.Fatal(err)
	}
	return n
}

// wantRows checks the dev user's rows in records, recovery_keys and device_approvals.
func (a *resetAPI) wantRows(recs, keys, approvals int) {
	a.t.Helper()
	r := a.count(`SELECT count(*) FROM backup.records WHERE user_id = 'dev-user'`)
	k := a.count(`SELECT count(*) FROM backup.recovery_keys WHERE user_id = 'dev-user'`)
	p := a.count(`SELECT count(*) FROM backup.device_approvals WHERE user_id = 'dev-user'`)
	if r != recs || k != keys || p != approvals {
		a.t.Fatalf("rows = %d records, %d keys, %d approvals; want %d, %d, %d", r, k, p, recs, keys, approvals)
	}
}

func (a *resetAPI) wantNotAllowed() {
	a.t.Helper()
	w := a.call("POST", "/v1/backup/reset", "", a.pending)
	var p struct{ Code string }
	if w.Code != 403 || json.Unmarshal(w.Body.Bytes(), &p) != nil || p.Code != "reset_not_allowed" {
		a.t.Fatalf("reset: %d %s, want 403 reset_not_allowed", w.Code, w.Body)
	}
}

func (a *resetAPI) wantAudit(types ...string) {
	a.t.Helper()
	for _, want := range types {
		found := false
		for _, got := range a.rec.types {
			found = found || got == want
		}
		if !found {
			a.t.Fatalf("audit %v lacks %s", a.rec.types, want)
		}
	}
}

func TestBackupResetWithoutAFreshEmailResetDeletesNothing(t *testing.T) {
	a := newResetAPI(t)
	a.seed()
	a.wantRows(2, 1, 1)

	// Never reset by email code.
	a.wantNotAllowed()
	// Reset 11 minutes ago.
	a.kc.resetAt = a.clk.Now().Add(-11 * time.Minute)
	a.kc.sessions[a.newSID] = a.clk.Now().Add(-10 * time.Minute)
	a.wantNotAllowed()
	// Fresh reset, but the caller's session is older than it (a stolen session).
	a.kc.resetAt = a.clk.Now().Add(-2 * time.Minute)
	a.kc.sessions[a.newSID] = a.clk.Now().Add(-time.Hour)
	a.wantNotAllowed()
	// Fresh reset, but the caller's session is not in Keycloak.
	delete(a.kc.sessions, a.newSID)
	a.wantNotAllowed()

	a.wantRows(2, 1, 1)
	if n := a.count(`SELECT count(*) FROM identity.devices WHERE status = 'pending'`); n != 1 {
		t.Fatalf("pending devices = %d, want 1", n)
	}
	a.status("GET", "/v1/backup/records", "", a.active, 200)
	if len(a.kc.revoked) != 0 {
		t.Fatalf("sessions revoked: %v", a.kc.revoked)
	}
	for _, ty := range a.rec.types {
		if ty == "backup.reset" || ty == audit.DeviceRemoved {
			t.Fatalf("audit %v", a.rec.types)
		}
	}
}

func TestBackupResetFromANewPhone(t *testing.T) {
	a := newResetAPI(t)
	a.seed()
	a.kc.resetAt = a.clk.Now().Add(-2 * time.Minute)

	// A pending phone cannot read anything before the reset.
	a.status("GET", "/v1/backup/records", "", a.pending, 403)
	a.status("POST", "/v1/backup/reset", "", a.pending, 204)

	a.wantRows(0, 0, 0)
	if n := a.count(`SELECT count(*) FROM backup.records WHERE user_id = 'other-user'`); n != 1 {
		t.Fatalf("another user's records = %d, want 1", n)
	}
	// The old phone is gone: identity answers 403 or 410 for it.
	if w := a.call("GET", "/v1/backup/records", "", a.active); w.Code != 403 && w.Code != 410 {
		t.Fatalf("old phone: %d %s", w.Code, w.Body)
	}
	if got := strings.Join(a.kc.revoked, ","); got != a.oldSID {
		t.Fatalf("revoked sessions = %q, want only the old phone's", got)
	}
	// The new phone is active and reads an empty backup.
	w := a.call("GET", "/v1/backup/records", "", a.pending)
	if w.Code != 200 || !strings.Contains(w.Body.String(), `"records":[]`) {
		t.Fatalf("new phone records: %d %s", w.Code, w.Body)
	}
	if n := a.count(`SELECT count(*) FROM identity.devices WHERE status = 'active'`); n != 1 {
		t.Fatalf("active devices = %d, want 1", n)
	}
	a.wantAudit(audit.DeviceRemoved, "backup.reset")

	// Repeating the call inside the window is a no-op that still answers 204.
	a.status("POST", "/v1/backup/reset", "", a.pending, 204)
	a.wantRows(0, 0, 0)
}

func TestBackupResetFromTheActivePhone(t *testing.T) {
	a := newResetAPI(t)
	a.seed()
	a.kc.resetAt = a.clk.Now().Add(-time.Minute)
	a.kc.sessions[a.oldSID] = a.clk.Now().Add(-30 * time.Second)
	a.status("POST", "/v1/backup/reset", "", a.active, 204)
	a.wantRows(0, 0, 0)
	a.status("GET", "/v1/backup/records", "", a.active, 200)
	if w := a.call("GET", "/v1/backup/records", "", a.pending); w.Code != 403 && w.Code != 410 {
		t.Fatalf("other phone: %d %s", w.Code, w.Body)
	}
}
