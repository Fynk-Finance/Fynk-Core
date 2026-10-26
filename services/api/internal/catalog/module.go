package catalog

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// New returns the catalog module. Until M9 implements it, every route answers 501.
func New(_ module.Deps) module.Module {
	return module.Stub{ModuleName: "catalog", Prefixes: []string{"/catalog"}}
}
