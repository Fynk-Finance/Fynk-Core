package recommendations

import (
	"context"

	"github.com/go-chi/chi/v5"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations/http"
)

// New returns the recommendations module. Until M11 implements it, only the example health path of
// contracts/modules/recommendations.yaml answers. Every other route answers 501.
func New(d module.Deps) module.Module {
	return stub{
		Stub: module.Stub{ModuleName: "recommendations", Prefixes: []string{"/recommendations"}},
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

func (server) RecommendationsHealth(context.Context, httpapi.RecommendationsHealthRequestObject) (httpapi.RecommendationsHealthResponseObject, error) {
	return httpapi.RecommendationsHealth200JSONResponse{Module: "recommendations", Status: httpapi.Stub}, nil
}
