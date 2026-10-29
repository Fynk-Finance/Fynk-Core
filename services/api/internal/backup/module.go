package backup

import (
	"io/fs"

	"github.com/go-chi/chi/v5"

	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/postgres"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/recovery"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// New returns the backup module. The recovery key endpoints are real; every other route under
// /backup and /device-approvals still answers 501 not_implemented through module.Stub, after
// authentication, until the implementation PRs mount it.
func New(d module.Deps) module.Module {
	// Without Redis the failed activation attempts are counted in the process (see recovery.MemoryLimiter).
	var lim recovery.Limiter = recovery.NewMemoryLimiter(d.Clock)
	if d.Redis != nil {
		lim = recovery.RedisLimiter{Client: d.Redis}
	}
	svc := recovery.NewService(postgres.New(d.DB), identity.NewDeviceReader(d.DB, d.Clock, d.Audit, nil),
		identity.NewDevices(d.DB, d.Clock), lim, d.Clock, d.Audit)
	return mod{
		Stub:     module.Stub{ModuleName: "backup", Prefixes: []string{"/backup", "/device-approvals"}},
		deps:     d,
		recovery: svc,
	}
}

type mod struct {
	module.Stub
	deps     module.Deps
	recovery recoveryService
}

// Routes mounts the implemented operations of the generated server behind auth.Require and the
// stub for the rest. chi picks the exact routes before the stub's wildcard.
func (m mod) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(server{recovery: m.recovery}, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  problem.RequestError,
		ResponseErrorHandlerFunc: problem.ResponseErrorHandler(m.deps.Log),
	})
	w := httpapi.ServerInterfaceWrapper{Handler: strict, ErrorHandlerFunc: problem.RequestError}
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Put("/backup/recovery-key", w.PutBackupRecoveryKey)
		g.Get("/backup/recovery-key", w.GetBackupRecoveryKey)
		g.Post("/backup/recovery-key/activate", w.ActivateWithRecoveryKey)
	})
	m.Stub.Routes(r)
}

// Migrations implements module.Module: the backup schema.
func (mod) Migrations() fs.FS { return migrations.FS }
