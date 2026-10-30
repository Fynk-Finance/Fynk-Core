package bank

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank/service"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// New returns the bank module: GET /providers, and the link (authorization and exchange) when
// the bank link settings are there. The query and refresh endpoints answer 501 until the next
// part of M5 step 2.
func New(d module.Deps) module.Module {
	return bankModule{deps: d, svc: newService(d)}
}

type bankModule struct {
	deps module.Deps
	svc  *service.Service
}

// Name implements module.Module.
func (bankModule) Name() string { return "bank" }

// Migrations implements module.Module: the bank.links table.
func (bankModule) Migrations() fs.FS { return migrations.FS }

// Routes mounts the server generated from contracts/modules/bank.yaml. Every route needs a
// token, checked before the generated server parses the request.
func (m bankModule) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(server{svc: m.svc}, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  problem.RequestError,
		ResponseErrorHandlerFunc: errorHandler(problem.ResponseErrorHandler(m.deps.Log)),
	})
	r.Group(func(r chi.Router) {
		r.Use(requireAuth, noStore)
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

// noStore keeps bank answers, which can carry bank tokens, out of every cache.
func noStore(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}
