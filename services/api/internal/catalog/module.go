package catalog

import (
	"io/fs"

	"github.com/go-chi/chi/v5"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/catalog/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/catalog/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// New returns the catalog module (M9): the shared merchant catalog with cancellation links.
func New(d module.Deps) module.Module {
	return mod{
		Stub: module.Stub{ModuleName: "catalog"},
		deps: d,
		srv:  server{store: pgStore{db: d.DB}},
	}
}

type mod struct {
	module.Stub
	deps module.Deps
	srv  server
}

// Routes mounts the server generated from the contract behind auth.Require.
func (m mod) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(m.srv, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  problem.RequestError,
		ResponseErrorHandlerFunc: problem.ResponseErrorHandler(m.deps.Log),
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		httpapi.HandlerWithOptions(strict, httpapi.ChiServerOptions{
			BaseRouter:       g,
			ErrorHandlerFunc: problem.RequestError,
		})
	})
}

// Migrations implements module.Module: the catalog schema.
func (mod) Migrations() fs.FS { return migrations.FS }
