package identity

import (
	"io/fs"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/devices"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/postgres"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// New returns the identity module. The devices endpoints are real; /me still answers 501
// until the profile lands.
func New(d module.Deps) module.Module {
	return mod{
		Stub: module.Stub{ModuleName: "identity", Prefixes: []string{"/me"}},
		deps: d,
		// The pool is only used when a request arrives, so a nil DB is fine at construction.
		devices: devices.NewService(postgres.New(d.DB), d.Clock, d.Audit, nil),
	}
}

type mod struct {
	module.Stub
	deps    module.Deps
	devices deviceService
}

// Routes mounts the server generated from the contract behind auth.Require, then the 501 stub routes.
func (m mod) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(server{devices: m.devices}, nil, httpapi.StrictHTTPServerOptions{
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
	m.Stub.Routes(r)
}

// Migrations implements module.Module: the identity schema.
func (mod) Migrations() fs.FS { return migrations.FS }
