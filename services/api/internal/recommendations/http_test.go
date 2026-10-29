package recommendations

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/advisor"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/http"
)

type fakeGen struct {
	res    advisor.Result
	err    error
	userID string
	calls  int
}

func (f *fakeGen) Generate(_ context.Context, userID string, _ advisor.Request) (advisor.Result, error) {
	f.calls++
	f.userID = userID
	return f.res, f.err
}

// router mounts the module's handler like Routes does, with a signed-in user instead of a token.
func router(gen generator) http.Handler {
	r := chi.NewRouter()
	strict := httpapi.NewStrictHandlerWithOptions(server{gen: gen}, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  problem.RequestError,
		ResponseErrorHandlerFunc: problem.ResponseErrorHandler(nil),
	})
	r.Group(func(g chi.Router) {
		g.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				next.ServeHTTP(w, req.WithContext(auth.WithUser(req.Context(), auth.User{ID: "sub-1"})))
			})
		})
		g.Use(strictSnapshot)
		httpapi.HandlerWithOptions(strict, httpapi.ChiServerOptions{BaseRouter: g, ErrorHandlerFunc: problem.RequestError})
	})
	return r
}

func design(t *testing.T) []byte {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("advisor", "testdata", "design.json"))
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func post(h http.Handler, body []byte) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/recommendations", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)
	return rec
}

func TestPostAnswersTheTextsWithTraceability(t *testing.T) {
	gen := &fakeGen{res: advisor.Result{
		Summary: "Vas bien.", Steps: []advisor.Step{{FactKey: "subscriptions.low_use", Title: "Suscripciones", Text: "Revisa."}},
		ModelID: "amazon.nova-lite-v1:0", PromptVersion: "2026-10-28.1", SnapshotHash: strings.Repeat("a", 64),
		GeneratedAt: time.Date(2026, 10, 28, 17, 0, 0, 0, time.UTC),
	}}
	rec := post(router(gen), design(t))
	if rec.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rec.Code, rec.Body)
	}
	var got httpapi.Recommendations
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatal(err)
	}
	if got.Fallback || len(got.Steps) != 1 || got.ModelId == "" || got.PromptVersion == "" || got.SnapshotHash == "" {
		t.Fatalf("unexpected answer: %+v", got)
	}
	if gen.userID != "sub-1" {
		t.Fatalf("user id %q", gen.userID)
	}
}

func TestPostRejectsWhatIsNotASnapshot(t *testing.T) {
	gen := &fakeGen{}
	raw := design(t)
	withMovements := bytes.Replace(raw, []byte(`"factKeys"`), []byte(`"transactions":[{"description":"NETFLIX"}],"factKeys"`), 1)
	for name, body := range map[string][]byte{
		"raw movements": withMovements,
		"over 16 KB":    append([]byte(`{"pad":"`+strings.Repeat("x", advisor.MaxRequestBytes)+`"}`), raw...),
		"not json":      []byte("hola"),
	} {
		t.Run(name, func(t *testing.T) {
			rec := post(router(gen), body)
			if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), `"code":"invalid_snapshot"`) {
				t.Fatalf("want 400 invalid_snapshot, got %d %s", rec.Code, rec.Body)
			}
			if rec.Header().Get("Content-Type") != problem.ContentType {
				t.Fatalf("content type %q", rec.Header().Get("Content-Type"))
			}
		})
	}
	if gen.calls != 0 {
		t.Fatal("an invalid snapshot must never reach the model")
	}
}

func TestPostRateLimited(t *testing.T) {
	rec := post(router(&fakeGen{err: advisor.ErrRateLimited}), design(t))
	if rec.Code != http.StatusTooManyRequests || !strings.Contains(rec.Body.String(), `"code":"rate_limited"`) {
		t.Fatalf("want 429 rate_limited, got %d %s", rec.Code, rec.Body)
	}
}

func TestSettingsDefaults(t *testing.T) {
	s := loadSettings(func(string) string { return "" })
	if s.ModelID != "amazon.nova-lite-v1:0" || s.Region != "us-east-1" || s.DailyLimit != 10 {
		t.Fatalf("defaults: %+v", s)
	}
	env := map[string]string{"RECOMMENDATIONS_MODEL_ID": "anthropic.claude-haiku-4-5", "AWS_REGION": "us-west-2", "RECOMMENDATIONS_DAILY_LIMIT": "3"}
	s = loadSettings(func(k string) string { return env[k] })
	if s.ModelID != "anthropic.claude-haiku-4-5" || s.Region != "us-west-2" || s.DailyLimit != 3 {
		t.Fatalf("from env: %+v", s)
	}
}

func TestLimiterKeyUsesTheBogotaDay(t *testing.T) {
	// 03:00 UTC on 29 Oct is still 28 Oct in Bogotá.
	if got := limiterKey("sub-1", time.Date(2026, 10, 29, 3, 0, 0, 0, time.UTC)); got != "recommendations:rl:sub-1:2026-10-28" {
		t.Fatal(got)
	}
}
