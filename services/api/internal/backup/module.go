package backup

import (
	"io/fs"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

// New returns the backup module. Its schema is migrated, but no endpoint is mounted yet: every
// route under /backup and /device-approvals answers 501 not_implemented through module.Stub,
// after authentication. The endpoint PRs mount the generated strict server here.
func New(_ module.Deps) module.Module {
	return mod{Stub: module.Stub{ModuleName: "backup", Prefixes: []string{"/backup", "/device-approvals"}}}
}

type mod struct {
	module.Stub
}

// Migrations implements module.Module: the backup schema.
func (mod) Migrations() fs.FS { return migrations.FS }
