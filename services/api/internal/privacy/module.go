package privacy

import (
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
)

// New returns the privacy module. /privacy/policy and /privacy/my-data are implemented;
// other privacy routes (like deletion requests) answer 501 until implemented.
func New(d module.Deps) module.Module {
	var profile ProfileReader
	if d.Config.KeycloakAdminClientSecret != "" {
		profile = identity.NewUserProfileReader(d.Config)
	}
	collector := NewCollector(d.DB, profile, d.Clock)
	return mod{
		Stub:      module.Stub{ModuleName: "privacy", Prefixes: []string{"/privacy"}},
		deps:      d,
		collector: collector,
	}
}

type mod struct {
	module.Stub
	deps      module.Deps
	collector *Collector
}

// Routes mounts the server generated from the contract, with requireAuth for protected paths,
// and the 501 stub for routes not yet implemented.
func (m mod) Routes(r chi.Router) {
	srv := server{collector: m.collector}
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

// requireAuth applies auth.Require to all routes except the public /privacy/health and /privacy/policy.
func requireAuth(next http.Handler) http.Handler {
	protected := auth.Require(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/privacy/health") || strings.HasSuffix(r.URL.Path, "/privacy/policy") {
			next.ServeHTTP(w, r)
			return
		}
		protected.ServeHTTP(w, r)
	})
}
