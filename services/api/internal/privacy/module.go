package privacy

import (
	"context"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
)

// New returns the privacy module. Until M13 implements it, only the example health path of
// contracts/modules/privacy.yaml answers. Every other route answers 501.
func New(d module.Deps) module.Module {
	return stub{
		Stub: module.Stub{ModuleName: "privacy", Prefixes: []string{"/privacy"}},
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

// server implements the generated httpapi.StrictServerInterface.
type server struct{}

func (server) PrivacyHealth(context.Context, httpapi.PrivacyHealthRequestObject) (httpapi.PrivacyHealthResponseObject, error) {
	return httpapi.PrivacyHealth200JSONResponse{Module: "privacy", Status: httpapi.Stub}, nil
}
