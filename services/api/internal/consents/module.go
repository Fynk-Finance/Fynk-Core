package consents

import (
	"context"
	"io/fs"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/service"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/store"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// expiryEvery is how often the job marks consents whose term ended (M4 prompt: daily).
const expiryEvery = 24 * time.Hour

// New returns the consents module. With a database it also starts the daily expiry job,
// which runs as long as the process. cmd/migrate builds the modules without a database,
// so it never starts the job.
func New(d module.Deps) module.Module {
	m := consentsModule{deps: d}
	if d.DB != nil {
		m.svc = service.New(store.New(d.DB), d.Clock, d.Audit, d.Log)
		go m.svc.RunExpiry(context.Background(), expiryEvery)
	}
	return m
}

type consentsModule struct {
	deps module.Deps
	svc  *service.Service
}

// Name implements module.Module.
func (consentsModule) Name() string { return "consents" }

// Migrations implements module.Module.
func (consentsModule) Migrations() fs.FS { return migrations.FS }

// Routes mounts the server generated from contracts/modules/consents.yaml. Every route needs
// a token, checked before the generated server parses the request.
func (m consentsModule) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(server{svc: m.svc}, nil, httpapi.StrictHTTPServerOptions{
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
		if strings.HasSuffix(r.URL.Path, "/consents/health") {
			next.ServeHTTP(w, r)
			return
		}
		protected.ServeHTTP(w, r)
	})
}
