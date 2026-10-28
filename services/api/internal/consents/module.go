package consents

import (
	"context"
	"io/fs"

	"github.com/go-chi/chi/v5"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// New returns the consents module. Until M4 implements it, only the example health path of
// contracts/modules/consents.yaml answers. Every other route answers 501.
func New(d module.Deps) module.Module {
	return stub{
		Stub: module.Stub{ModuleName: "consents", Prefixes: []string{"/consent-texts", "/consents"}},
		deps: d,
	}
}

type stub struct {
	module.Stub
	deps module.Deps
}

// Migrations implements module.Module: the consents schema, already real while the routes
// are still stubs.
func (stub) Migrations() fs.FS { return migrations.FS }

// Routes mounts the server generated from the contract, then the 501 stub routes.
func (s stub) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(server{}, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  problem.RequestError,
		ResponseErrorHandlerFunc: problem.ResponseErrorHandler(s.deps.Log),
	})
	httpapi.HandlerWithOptions(strict, httpapi.ChiServerOptions{
		BaseRouter:       r,
		ErrorHandlerFunc: problem.RequestError,
	})
	s.Stub.Routes(r)
}

// server implements the generated httpapi.StrictServerInterface.
type server struct{}

func (server) ConsentsHealth(context.Context, httpapi.ConsentsHealthRequestObject) (httpapi.ConsentsHealthResponseObject, error) {
	return httpapi.ConsentsHealth200JSONResponse{Module: "consents", Status: httpapi.Stub}, nil
}
