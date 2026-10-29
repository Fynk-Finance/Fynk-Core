package market

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/catalog"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/quotes"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market/reference"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

type fakeCatalog struct{ err error }

func (f fakeCatalog) Get(context.Context) (catalog.Catalog, error) {
	return catalog.Catalog{Products: []catalog.Product{{ID: "cdt-demo-180", Name: "CDT 180", Issuer: "Banco Demo", TermDays: 180, RateEaBps: 1050, Risk: "low", Simulated: true}}}, f.err
}

type fakeReference struct{ err error }

func (f fakeReference) Get(context.Context) (reference.Result, error) {
	return reference.Result{Rate: reference.Rate{Week: time.Date(2026, 10, 19, 0, 0, 0, 0, time.UTC), TermDays: 360, RateEaBps: 985}}, f.err
}

type fakeQuotes struct{ err error }

func (f fakeQuotes) Get(context.Context) (quotes.Board, error) {
	return quotes.Board{Quotes: []quotes.Quote{{Symbol: "AAPL", Name: "Apple", LastPriceCents: 22750, DayChangeBps: 125}}}, f.err
}

func router(s server, user string) http.Handler {
	r := chi.NewRouter()
	strict := httpapi.NewStrictHandlerWithOptions(s, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc: problem.RequestError, ResponseErrorHandlerFunc: problem.ResponseErrorHandler(nil),
	})
	r.Group(func(g chi.Router) {
		g.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				next.ServeHTTP(w, req.WithContext(auth.WithUser(req.Context(), auth.User{ID: user})))
			})
		})
		httpapi.HandlerWithOptions(strict, httpapi.ChiServerOptions{BaseRouter: g, ErrorHandlerFunc: problem.RequestError})
	})
	return r
}

func call(h http.Handler, method, path string, body []byte) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	h.ServeHTTP(rec, req)
	return rec
}

func TestEndpointsAnswer(t *testing.T) {
	h := router(server{catalog: fakeCatalog{}, reference: fakeReference{}, quotes: fakeQuotes{}}, "u1")
	for _, tc := range []struct{ method, path, want string }{
		{http.MethodGet, "/market/cdt-products", `"simulated":true`},
		{http.MethodGet, "/market/cdt-reference", `"week":"2026-10-19"`},
		{http.MethodPost, "/market/quotes", `"lastPriceCents":22750`},
	} {
		rec := call(h, tc.method, tc.path, []byte(`{}`))
		if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), tc.want) {
			t.Errorf("%s %s: %d %s", tc.method, tc.path, rec.Code, rec.Body)
		}
	}
}

func TestQuotesAcceptsAnEmptyBody(t *testing.T) {
	h := router(server{quotes: fakeQuotes{}}, "u1")
	if rec := call(h, http.MethodPost, "/market/quotes", nil); rec.Code != http.StatusOK {
		t.Fatalf("empty body: %d %s", rec.Code, rec.Body)
	}
}

func TestSameAnswerForEveryUser(t *testing.T) {
	s := server{catalog: fakeCatalog{}, reference: fakeReference{}, quotes: fakeQuotes{}}
	a := call(router(s, "user-with-a-big-balance"), http.MethodGet, "/market/cdt-products", nil).Body.String()
	b := call(router(s, "user-with-no-balance"), http.MethodGet, "/market/cdt-products", nil).Body.String()
	if a != b {
		t.Fatalf("the catalog must not depend on the user:\n%s\n%s", a, b)
	}
}

func TestUnavailableIs503(t *testing.T) {
	h := router(server{
		catalog:   fakeCatalog{err: catalog.ErrUnavailable},
		reference: fakeReference{err: reference.ErrUnavailable},
		quotes:    fakeQuotes{err: errors.Join(quotes.ErrUnavailable, errors.New("x"))},
	}, "u1")
	for _, p := range []string{"/market/cdt-products", "/market/cdt-reference"} {
		if rec := call(h, http.MethodGet, p, nil); rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "market_unavailable") {
			t.Errorf("%s: %d %s", p, rec.Code, rec.Body)
		}
	}
	if rec := call(h, http.MethodPost, "/market/quotes", []byte(`{}`)); rec.Code != http.StatusServiceUnavailable {
		t.Errorf("quotes: %d", rec.Code)
	}
}

func TestSettings(t *testing.T) {
	s := loadSettings(func(string) string { return "" })
	if len(s.Symbols) != 10 || s.AlpacaKeyID != "" {
		t.Fatalf("defaults: %+v", s)
	}
}
