package app

import (
	"bytes"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

// probe is a module with two routes that misbehave on purpose.
type probe struct {
	module.Stub
	readErr *error
}

func (p probe) Routes(r chi.Router) {
	r.Get("/probe/panic", func(http.ResponseWriter, *http.Request) {
		panic("token=super-secret-value")
	})
	r.Post("/probe/read", func(w http.ResponseWriter, r *http.Request) {
		_, *p.readErr = io.Copy(io.Discard, r.Body)
		w.WriteHeader(http.StatusNoContent)
	})
}

func probeServer(t *testing.T, logs io.Writer) (*httptest.Server, *error) {
	t.Helper()
	var readErr error
	h, err := NewRouter(slog.New(slog.NewJSONHandler(logs, nil)),
		[]Module{probe{Stub: module.Stub{ModuleName: "probe"}, readErr: &readErr}}, nil)
	if err != nil {
		t.Fatalf("NewRouter: %v", err)
	}
	srv := httptest.NewServer(h)
	t.Cleanup(srv.Close)
	return srv, &readErr
}

func TestAPanicAnswers500ProblemJSONAndIsLoggedWithoutItsText(t *testing.T) {
	var logs bytes.Buffer
	srv, _ := probeServer(t, &logs)

	res, body := get(t, srv.URL+"/v1/probe/panic", "")
	if res.status != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", res.status)
	}
	if ct := res.header.Get("Content-Type"); !strings.HasPrefix(ct, "application/problem+json") {
		t.Fatalf("Content-Type = %q, want problem+json", ct)
	}
	if strings.Contains(string(body), "super-secret-value") {
		t.Fatal("the answer carries the panic text")
	}
	// The panic goes through the application logger, which redacts and reaches the log group,
	// and never with its text: a panic message can hold what the request carried.
	if !strings.Contains(logs.String(), `"msg":"panic"`) || !strings.Contains(logs.String(), "/v1/probe/panic") {
		t.Fatalf("the panic was not logged: %s", logs.String())
	}
	if strings.Contains(logs.String(), "super-secret-value") {
		t.Fatal("the log carries the panic text")
	}
}

func TestARequestBodyOverTheLimitCannotBeRead(t *testing.T) {
	srv, readErr := probeServer(t, io.Discard)

	post := func(size int) {
		t.Helper()
		res, err := http.Post(srv.URL+"/v1/probe/read", "application/octet-stream", bytes.NewReader(make([]byte, size)))
		if err != nil {
			// The server may close the connection of a body it refuses.
			return
		}
		_ = res.Body.Close()
	}

	post(1024)
	if *readErr != nil {
		t.Fatalf("a small body must be readable: %v", *readErr)
	}
	post(maxBodyBytes + 1)
	var tooBig *http.MaxBytesError
	if !errors.As(*readErr, &tooBig) {
		t.Fatalf("a body over the limit must fail with MaxBytesError, got %v", *readErr)
	}
}
