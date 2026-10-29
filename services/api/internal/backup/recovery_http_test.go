package backup

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/recovery"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

const devID = "3f8b2a54-6a1e-4c58-9d3b-7a1f0c2e9b11"

func b64(n int, b byte) string { return base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{b}, n)) }

type fakeRecovery struct {
	setErr, getErr, actErr error
	gotSet                 recovery.Key
	gotUser                auth.User
	gotProof               []byte
	sets, acts             int
}

func (f *fakeRecovery) Set(_ context.Context, u auth.User, k recovery.Key) error {
	f.sets, f.gotUser, f.gotSet = f.sets+1, u, k
	return f.setErr
}
func (f *fakeRecovery) Get(context.Context, auth.User) (recovery.Key, error) {
	if f.getErr != nil {
		return recovery.Key{}, f.getErr
	}
	return recovery.Key{WrappedDEK: bytes.Repeat([]byte{1}, 48), Nonce: bytes.Repeat([]byte{2}, 12), Salt: bytes.Repeat([]byte{3}, 16),
		KDF: "argon2id", MemoryKiB: 65536, Iterations: 3, Parallelism: 1, CreatedAt: time.Date(2026, 10, 28, 0, 0, 0, 0, time.UTC)}, nil
}
func (f *fakeRecovery) Activate(_ context.Context, _ auth.User, p []byte) error {
	f.acts, f.gotProof = f.acts+1, p
	return f.actErr
}

func serve(t *testing.T, f *fakeRecovery) http.Handler {
	t.Helper()
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	m := New(module.Deps{}).(mod)
	m.recovery = f
	r := chi.NewRouter()
	r.Route("/v1", m.Routes)
	return r
}

func do(h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	var rd io.Reader
	if body != "" {
		rd = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, path, rd)
	req.Header.Set("Authorization", "Bearer "+auth.DevToken)
	req.Header.Set("X-Device-Id", devID)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func wantProblem(t *testing.T, rec *httptest.ResponseRecorder, status int, code string) {
	t.Helper()
	var p problem.Problem
	if rec.Code != status || json.Unmarshal(rec.Body.Bytes(), &p) != nil || p.Code != code {
		t.Fatalf("got %d %s, want %d %s", rec.Code, rec.Body, status, code)
	}
	if rec.Header().Get("Content-Type") != problem.ContentType {
		t.Fatalf("Content-Type %q", rec.Header().Get("Content-Type"))
	}
	for _, secret := range []string{b64(48, 1), b64(32, 7), b64(32, 5), devID} {
		if strings.Contains(rec.Body.String(), secret) {
			t.Fatalf("response leaks request data: %s", rec.Body)
		}
	}
}

func putBody(mut func(map[string]any)) string {
	m := map[string]any{
		"wrappedDek": b64(48, 1), "nonce": b64(12, 2), "salt": b64(16, 3), "kdf": "argon2id",
		"kdfParams":       map[string]any{"memoryKiB": 65536, "iterations": 3, "parallelism": 1},
		"deviceProofHash": b64(32, 5),
	}
	if mut != nil {
		mut(m)
	}
	b, _ := json.Marshal(m)
	return string(b)
}

func TestPutRecoveryKey(t *testing.T) {
	f := &fakeRecovery{}
	h := serve(t, f)
	if rec := do(h, "PUT", "/v1/backup/recovery-key", putBody(nil)); rec.Code != 204 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if f.gotUser.DeviceID != devID || len(f.gotSet.WrappedDEK) != 48 || len(f.gotSet.ProofHash) != 32 || f.gotSet.Iterations != 3 {
		t.Fatalf("service got %+v %+v", f.gotUser, f.gotSet)
	}
	bad := map[string]func(map[string]any){
		"wrappedDek":      func(m map[string]any) { m["wrappedDek"] = b64(47, 1) },
		"nonce":           func(m map[string]any) { m["nonce"] = b64(13, 2) },
		"salt":            func(m map[string]any) { m["salt"] = "AAECAwQFBgcICQoLDA0ODw" },
		"deviceProofHash": func(m map[string]any) { m["deviceProofHash"] = "not base64 !!!" },
		"kdfParams": func(m map[string]any) {
			m["kdfParams"] = map[string]any{"memoryKiB": 65536, "iterations": 3, "parallelism": 2}
		},
	}
	for field, mut := range bad {
		before := f.sets
		rec := do(h, "PUT", "/v1/backup/recovery-key", putBody(mut))
		if f.sets != before {
			t.Fatalf("%s: %d %s", field, rec.Code, rec.Body)
		}
		wantProblem(t, rec, 400, "invalid_request")
	}
}

func TestPutRecoveryKeyNotActiveAndErrors(t *testing.T) {
	f := &fakeRecovery{setErr: recovery.ErrNotActive}
	wantProblem(t, do(serve(t, f), "PUT", "/v1/backup/recovery-key", putBody(nil)), 403, "device_not_active")
	f.setErr = errors.New("db down with secret " + b64(48, 1))
	rec := do(serve(t, f), "PUT", "/v1/backup/recovery-key", putBody(nil))
	wantProblem(t, rec, 500, "internal")
}

func TestGetRecoveryKey(t *testing.T) {
	f := &fakeRecovery{}
	rec := do(serve(t, f), "GET", "/v1/backup/recovery-key", "")
	if rec.Code != 200 || strings.Contains(strings.ToLower(rec.Body.String()), "proof") ||
		!strings.Contains(rec.Body.String(), b64(48, 1)) || !strings.Contains(rec.Body.String(), `"memoryKiB":65536`) {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	f.getErr = recovery.ErrNoKey
	wantProblem(t, do(serve(t, f), "GET", "/v1/backup/recovery-key", ""), 404, "recovery_key_not_found")
	f.getErr = recovery.ErrNotActive
	wantProblem(t, do(serve(t, f), "GET", "/v1/backup/recovery-key", ""), 403, "device_not_active")
}

func TestActivate(t *testing.T) {
	body := `{"deviceProof":"` + b64(32, 7) + `"}`
	f := &fakeRecovery{}
	h := serve(t, f)
	if rec := do(h, "POST", "/v1/backup/recovery-key/activate", body); rec.Code != 204 || len(f.gotProof) != 32 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	before := f.acts
	wantProblem(t, do(h, "POST", "/v1/backup/recovery-key/activate", `{"deviceProof":"`+b64(31, 7)+`"}`), 400, "invalid_request")
	if f.acts != before {
		t.Fatal("a malformed proof reached the service")
	}
	for err, want := range map[error][2]any{
		recovery.ErrMismatch:  {422, "proof_mismatch"},
		recovery.ErrTooMany:   {429, "too_many_attempts"},
		recovery.ErrNoKey:     {404, "recovery_key_not_found"},
		recovery.ErrRemoved:   {410, "device_removed"},
		recovery.ErrNotActive: {403, "device_not_active"},
	} {
		f.actErr = err
		wantProblem(t, do(h, "POST", "/v1/backup/recovery-key/activate", body), want[0].(int), want[1].(string))
	}
}

func TestOtherRoutesStayNotImplementedAndAuthIsRequired(t *testing.T) {
	h := serve(t, &fakeRecovery{})
	for _, r := range [][2]string{{"POST", "/v1/backup/reset"}, {"PUT", "/v1/device-approvals"},
		{"DELETE", "/v1/backup/recovery-key"}} {
		wantProblem(t, do(h, r[0], r[1], ""), 501, "not_implemented")
	}
	req := httptest.NewRequest("GET", "/v1/backup/recovery-key", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	wantProblem(t, rec, 401, "unauthorized")
}
