package backup

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// New returns the backup module. The contract in contracts/modules/backup.yaml is complete and
// generates internal/backup/http, but M2 has not implemented the endpoints yet, so the generated
// handler is not mounted: every route under /backup and /device-approvals answers 501 not_implemented
// through module.Stub, after authentication. The implementation PRs mount the generated strict
// server here and drop the stub.
func New(_ module.Deps) module.Module {
	return module.Stub{ModuleName: "backup", Prefixes: []string{"/backup", "/device-approvals"}}
}
