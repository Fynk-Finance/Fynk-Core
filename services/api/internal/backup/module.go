package backup

import (
	"context"

	"github.com/go-chi/chi/v5"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// New returns the backup module. Until M2 implements it, only the example health path of
// contracts/modules/backup.yaml answers. Every other route answers 501.
func New(d module.Deps) module.Module {
	return stub{
		Stub: module.Stub{ModuleName: "backup", Prefixes: []string{"/backup", "/device-approvals"}},
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

func (server) BackupHealth(context.Context, httpapi.BackupHealthRequestObject) (httpapi.BackupHealthResponseObject, error) {
	return httpapi.BackupHealth200JSONResponse{Module: "backup", Status: httpapi.Stub}, nil
}
