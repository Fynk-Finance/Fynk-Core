package catalog

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/catalog/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

func router(s server) http.Handler {
	r := chi.NewRouter()
	strict := httpapi.NewStrictHandlerWithOptions(s, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc: problem.RequestError, ResponseErrorHandlerFunc: problem.ResponseErrorHandler(nil),
	})
	httpapi.HandlerWithOptions(strict, httpapi.ChiServerOptions{BaseRouter: r, ErrorHandlerFunc: problem.RequestError})
	return r
}

func get(h http.Handler, ifNoneMatch string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/catalog/merchants", nil)
	if ifNoneMatch != "" {
		req.Header.Set("If-None-Match", ifNoneMatch)
	}
	h.ServeHTTP(rec, req)
	return rec
}

func TestTheCatalogComesWithItsETag(t *testing.T) {
	rec := get(router(server{store: fakeStore{merchants: sample()}}), "")
	if rec.Code != http.StatusOK || rec.Header().Get("ETag") == "" {
		t.Fatalf("want 200 with an ETag, got %d %q", rec.Code, rec.Header().Get("ETag"))
	}
	var body struct {
		Merchants []struct {
			Key         string   `json:"key"`
			CancelURL   *string  `json:"cancelUrl"`
			CancelSteps []string `json:"cancelSteps"`
			Patterns    []string `json:"matchPatterns"`
		} `json:"merchants"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Merchants) != 2 || body.Merchants[0].Key != "netflix" || *body.Merchants[0].CancelURL != "https://www.netflix.com/cancelplan" {
		t.Fatalf("unexpected body: %s", rec.Body.String())
	}
	// A merchant with nothing to cancel online: null URL and empty lists, never null lists.
	if body.Merchants[1].CancelURL != nil || body.Merchants[1].CancelSteps == nil || body.Merchants[1].Patterns == nil {
		t.Fatalf("empty fields must be null URL and [] lists: %s", rec.Body.String())
	}
}

func TestTheSameETagGets304WithNoBody(t *testing.T) {
	h := router(server{store: fakeStore{merchants: sample()}})
	etag := get(h, "").Header().Get("ETag")
	rec := get(h, etag)
	if rec.Code != http.StatusNotModified || rec.Body.Len() != 0 || rec.Header().Get("ETag") != etag {
		t.Fatalf("want 304, no body, same ETag; got %d %q %q", rec.Code, rec.Body.String(), rec.Header().Get("ETag"))
	}
	if rec := get(h, `"old"`); rec.Code != http.StatusOK {
		t.Fatalf("an old ETag gets the catalog, got %d", rec.Code)
	}
}

func TestAStoreErrorIsAProblem(t *testing.T) {
	rec := get(router(server{store: fakeStore{err: errors.New("db down")}}), "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d", rec.Code)
	}
}
