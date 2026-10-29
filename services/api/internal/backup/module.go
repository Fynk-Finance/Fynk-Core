package backup

import (
	"io/fs"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/approvals"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/postgres"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/records"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/recovery"
	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// New returns the backup module. The recovery key, record and device approval endpoints are real; every other route under
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
	recs := records.NewService(postgres.NewRecords(d.DB), identity.NewDeviceReader(d.DB, d.Clock, d.Audit, nil), d.Clock, d.Audit)
	apps := approvals.NewService(postgres.NewApprovals(d.DB), identity.NewDeviceReader(d.DB, d.Clock, d.Audit, nil),
		identity.NewDevices(d.DB, d.Clock), d.Clock, d.Audit, uuid.NewString)
	return mod{
		Stub:      module.Stub{ModuleName: "backup", Prefixes: []string{"/backup", "/device-approvals"}},
		deps:      d,
		recovery:  svc,
		records:   recs,
		approvals: apps,
	}
}

type mod struct {
	module.Stub
	deps      module.Deps
	recovery  recoveryService
	records   recordsService
	approvals approvalsService
}

// Routes mounts the implemented operations of the generated server behind auth.Require and the
// stub for the rest. chi picks the exact routes before the stub's wildcard.
func (m mod) Routes(r chi.Router) {
	strict := httpapi.NewStrictHandlerWithOptions(server{recovery: m.recovery, records: m.records, approvals: m.approvals}, nil, httpapi.StrictHTTPServerOptions{
		RequestErrorHandlerFunc:  requestError,
		ResponseErrorHandlerFunc: problem.ResponseErrorHandler(m.deps.Log),
	})
	w := httpapi.ServerInterfaceWrapper{Handler: strict, ErrorHandlerFunc: problem.RequestError}
	// The stub goes first: it handles the bare /device-approvals for every method, and a later
	// registration of the same pattern replaces the earlier ones for that method.
	m.Stub.Routes(r)
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Put("/backup/recovery-key", w.PutBackupRecoveryKey)
		g.Get("/backup/recovery-key", w.GetBackupRecoveryKey)
		g.Post("/backup/recovery-key/activate", w.ActivateWithRecoveryKey)
		g.With(limitBody).Put("/backup/records", w.PutBackupRecords)
		g.Get("/backup/records", w.GetBackupRecords)
		g.Post("/device-approvals", w.CreateDeviceApproval)
		g.Get("/device-approvals/pending", w.ListPendingDeviceApprovals)
		g.Get("/device-approvals/{id}", w.GetDeviceApproval)
		g.Post("/device-approvals/{id}/approve", w.ApproveDeviceApproval)
		g.Post("/device-approvals/{id}/reject", w.RejectDeviceApproval)
	})
}

// Migrations implements module.Module: the backup schema.
func (mod) Migrations() fs.FS { return migrations.FS }
