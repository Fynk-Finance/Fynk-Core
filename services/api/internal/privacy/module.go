package privacy

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	consents "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/ports"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/migrations"
)

// New returns the privacy module (M13).
func New(d module.Deps) module.Module {
	var profile ProfileReader
	var sessions identity.Sessions
	var userDeleter identity.UserDeleter

	if d.Config.KeycloakAdminClientSecret != "" {
		profile = identity.NewUserProfileReader(d.Config)
		sessions = identity.NewSessions(d.Config)
		userDeleter = identity.NewUserDeleter(d.Config)
	}
	consentsRevoker := consents.NewConsentsRevoker(d)

	collector := NewCollector(d.DB, profile, d.Clock)
	deleter := NewDeleter(d.DB, d.Clock, d.Audit, sessions, consentsRevoker, userDeleter)

	return mod{
		Stub:      module.Stub{ModuleName: "privacy", Prefixes: []string{"/privacy"}},
		deps:      d,
		collector: collector,
		deleter:   deleter,
	}
}

type mod struct {
	module.Stub
	deps      module.Deps
	collector *Collector
	deleter   *Deleter
}

// Migrations implements module.Module: the privacy schema.
func (mod) Migrations() fs.FS { return migrations.FS }

// Routes mounts the server generated from the contract, with requireAuth for protected paths,
// and the 501 stub for routes not yet implemented.
func (m mod) Routes(r chi.Router) {
	srv := server{collector: m.collector, deleter: m.deleter}
	strict := httpapi.NewStrictHandlerWithOptions(srv, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  problem.RequestError,
		ResponseErrorHandlerFunc: problem.ResponseErrorHandler(m.deps.Log),
	})

	r.Group(func(g chi.Router) {
		g.Use(requireAuth)
		httpapi.HandlerWithOptions(strict, httpapi.ChiServerOptions{
			BaseRouter:       g,
			ErrorHandlerFunc: problem.RequestError,
		})
	})

	m.Stub.Routes(r)
}

// requireAuth applies auth.Require to all routes except the public /privacy/health,
// /privacy/policy and GET /privacy/deletion-requests/{id}.
func requireAuth(next http.Handler) http.Handler {
	protected := auth.Require(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/privacy/health") ||
			strings.HasSuffix(r.URL.Path, "/privacy/policy") ||
			(r.Method == http.MethodGet && strings.Contains(r.URL.Path, "/privacy/deletion-requests/")) {
			next.ServeHTTP(w, r)
			return
		}
		protected.ServeHTTP(w, r)
	})
}
