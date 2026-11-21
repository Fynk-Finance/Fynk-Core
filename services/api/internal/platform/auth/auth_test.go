package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
)

// protected answers 200 with the user id when Require lets the request through.
var protected = Require(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
	u, ok := UserFrom(r.Context())
	if !ok {
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	w.Header().Set("X-User", u.ID)
	w.Header().Set("X-Device", u.DeviceID)
}))

func call(authorization, device string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	if authorization != "" {
		req.Header.Set("Authorization", authorization)
	}
	if device != "" {
		req.Header.Set(DeviceHeader, device)
	}
	rec := httptest.NewRecorder()
	protected.ServeHTTP(rec, req)
	return rec
}

func withVerifier(t *testing.T, v Verifier) {
	t.Helper()
	Install(v)
	t.Cleanup(func() { Install(nil) })
}

func TestDevTokenIsAcceptedInLocal(t *testing.T) {
	withVerifier(t, DevVerifier{Env: config.EnvLocal})
	rec := call("Bearer dev-token", "device-1")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if rec.Header().Get("X-User") != "dev-user" || rec.Header().Get("X-Device") != "device-1" {
		t.Fatalf("user headers = %v", rec.Header())
	}
}

func TestDevTokenIsRejectedOutsideLocal(t *testing.T) {
	for _, env := range []config.Env{config.EnvStaging, config.EnvProd, ""} {
		withVerifier(t, DevVerifier{Env: env})
		if rec := call("Bearer dev-token", ""); rec.Code != http.StatusUnauthorized {
			t.Fatalf("env %q: status = %d, want 401", env, rec.Code)
		}
	}
}

func TestRejectsMissingWrongOrMalformedTokens(t *testing.T) {
	withVerifier(t, DevVerifier{Env: config.EnvLocal})
	for _, h := range []string{"", "dev-token", "Basic dev-token", "Bearer ", "Bearer other-token"} {
		rec := call(h, "")
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("Authorization %q: status = %d, want 401", h, rec.Code)
		}
		if ct := rec.Header().Get("Content-Type"); ct != "application/problem+json" {
			t.Fatalf("Authorization %q: Content-Type = %q", h, ct)
		}
	}
}

func TestBearerSchemeIsCaseInsensitive(t *testing.T) {
	withVerifier(t, DevVerifier{Env: config.EnvLocal})
	if rec := call("bearer dev-token", ""); rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestFailsClosedWithoutAVerifier(t *testing.T) {
	Install(nil)
	if rec := call("Bearer dev-token", ""); rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestUserFromAndWithUser(t *testing.T) {
	if _, ok := UserFrom(context.Background()); ok {
		t.Fatal("UserFrom found a user in an empty context")
	}
	want := User{ID: "u1", EmailVerified: true, DeviceID: "d1"}
	got, ok := UserFrom(WithUser(context.Background(), want))
	if !ok || got != want {
		t.Fatalf("got %+v, %v", got, ok)
	}
}
