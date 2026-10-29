package backup

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/reset"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

type fakeReset struct {
	err     error
	calls   int
	gotUser auth.User
}

func (f *fakeReset) Reset(_ context.Context, u auth.User) error {
	f.calls, f.gotUser = f.calls+1, u
	return f.err
}

func serveReset(t *testing.T, f *fakeReset) http.Handler {
	t.Helper()
	auth.Install(auth.DevVerifier{Env: config.EnvLocal})
	t.Cleanup(func() { auth.Install(nil) })
	m := New(module.Deps{}).(mod)
	m.reset = f
	r := chi.NewRouter()
	r.Route("/v1", m.Routes)
	return r
}

func TestResetBackupAnswers204(t *testing.T) {
	f := &fakeReset{}
	rec := do(serveReset(t, f), "POST", "/v1/backup/reset", "")
	if rec.Code != http.StatusNoContent || rec.Body.Len() != 0 || f.calls != 1 || f.gotUser.DeviceID != devID {
		t.Fatalf("%d %q calls=%d device=%q", rec.Code, rec.Body, f.calls, f.gotUser.DeviceID)
	}
}

func TestResetBackupErrors(t *testing.T) {
	f := &fakeReset{}
	h := serveReset(t, f)
	for _, c := range []struct {
		err    error
		status int
		code   string
	}{
		{reset.ErrNotAllowed, 403, "reset_not_allowed"},
		{reset.ErrNotActive, 403, "device_not_active"},
		{errors.New("keycloak down for sid-secret"), 500, "internal"},
	} {
		f.err = c.err
		rec := do(h, "POST", "/v1/backup/reset", "")
		wantProblem(t, rec, c.status, c.code)
		if strings.Contains(rec.Body.String(), "secret") {
			t.Fatalf("problem leaks data: %s", rec.Body)
		}
	}
}

func TestResetBackupNeedsAuthentication(t *testing.T) {
	f := &fakeReset{}
	h := serveReset(t, f)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/v1/backup/reset", nil))
	wantProblem(t, rec, 401, "unauthorized")
	if f.calls != 0 {
		t.Fatal("service called without authentication")
	}
}
