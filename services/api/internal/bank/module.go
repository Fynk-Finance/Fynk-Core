package bank

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// New returns the bank module. GET /providers is served; the link and query endpoints answer
// 501 until M5 step 2 adds the authorizations, the links table and the adapters behind them.
func New(d module.Deps) module.Module {
	return bankModule{deps: d}
}

type bankModule struct {
	deps module.Deps
}

// Name implements module.Module.
func (bankModule) Name() string { return "bank" }

// Migrations implements module.Module. The bank.links table comes in M5 step 2.
func (bankModule) Migrations() fs.FS { return module.NoMigrations }

// Routes mounts the server generated from contracts/modules/bank.yaml. Every route needs a
// token, checked before the generated server parses the request.
func (m bankModule) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(server{}, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  problem.RequestError,
		ResponseErrorHandlerFunc: errorHandler(problem.ResponseErrorHandler(m.deps.Log)),
	})
	r.Group(func(r chi.Router) {
		r.Use(requireAuth)
		httpapi.HandlerWithOptions(strict, httpapi.ChiServerOptions{
			BaseRouter:       r,
			ErrorHandlerFunc: problem.RequestError,
		})
	})
}

// requireAuth is auth.Require for every route except the public example health path,
// which the contract marks with security: [].
func requireAuth(next http.Handler) http.Handler {
	protected := auth.Require(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/bank/health") {
			next.ServeHTTP(w, r)
			return
		}
		protected.ServeHTTP(w, r)
	})
}
