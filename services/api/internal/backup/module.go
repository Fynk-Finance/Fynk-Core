package backup

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// New returns the backup module. Until M2 implements it, every route answers 501.
func New(_ module.Deps) module.Module {
	return module.Stub{ModuleName: "backup", Prefixes: []string{"/backup", "/device-approvals"}}
}
