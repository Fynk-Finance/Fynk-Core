package problem

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func decode(t *testing.T, rec *httptest.ResponseRecorder) Problem {
	t.Helper()
	if ct := rec.Header().Get("Content-Type"); ct != ContentType {
		t.Fatalf("Content-Type = %q, want %q", ct, ContentType)
	}
	var p Problem
	if err := json.Unmarshal(rec.Body.Bytes(), &p); err != nil {
		t.Fatalf("body is not JSON: %v", err)
	}
	return p
}

func TestWriteSendsAnRFC9457Body(t *testing.T) {
	rec := httptest.NewRecorder()
	Write(rec, New(http.StatusConflict, "consent_revoked", "Consent revoked", "The consent was revoked."))

	if rec.Code != http.StatusConflict {
		t.Fatalf("status = %d", rec.Code)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("missing Cache-Control: no-store")
	}
	got := decode(t, rec)
	want := Problem{
		Type: "/problems/consent_revoked", Title: "Consent revoked", Status: 409,
		Detail: "The consent was revoked.", Code: "consent_revoked",
	}
	if got != want {
		t.Fatalf("got %+v, want %+v", got, want)
	}
}

func TestOmitsEmptyDetailAndInstance(t *testing.T) {
	rec := httptest.NewRecorder()
	Write(rec, New(http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed", ""))
	var raw map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &raw)
	if _, ok := raw["detail"]; ok {
		t.Fatal("empty detail was written")
	}
	if _, ok := raw["instance"]; ok {
		t.Fatal("empty instance was written")
	}
}

func TestHelpers(t *testing.T) {
	cases := []struct {
		name   string
		h      http.HandlerFunc
		status int
		code   string
	}{
		{"NotImplemented", NotImplemented, 501, "not_implemented"},
		{"Unauthorized", Unauthorized, 401, "unauthorized"},
		{"NotFound", NotFound, 404, "not_found"},
		{"MethodNotAllowed", MethodNotAllowed, 405, "method_not_allowed"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			c.h(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
			p := decode(t, rec)
			if rec.Code != c.status || p.Status != c.status || p.Code != c.code {
				t.Fatalf("got %d %+v", rec.Code, p)
			}
		})
	}
}
