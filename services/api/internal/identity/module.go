package identity

import (
	"context"
	"io/fs"

	"github.com/go-chi/chi/v5"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// New returns the identity module. Until M1 implements it, only the example health path of
// contracts/modules/identity.yaml answers. Every other route answers 501.
func New(d module.Deps) module.Module {
	return stub{
		Stub: module.Stub{ModuleName: "identity", Prefixes: []string{"/me", "/devices"}},
		deps: d,
	}
}

type stub struct {
	module.Stub
	deps module.Deps
}

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

// Migrations implements module.Module: the identity schema.
func (stub) Migrations() fs.FS { return migrations.FS }

// server implements the generated httpapi.StrictServerInterface.
type server struct{}

func (server) IdentityHealth(context.Context, httpapi.IdentityHealthRequestObject) (httpapi.IdentityHealthResponseObject, error) {
	return httpapi.IdentityHealth200JSONResponse{Module: "identity", Status: httpapi.Stub}, nil
}
