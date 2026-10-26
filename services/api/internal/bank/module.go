package bank

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// New returns the bank module. Until M5 implements it, every route answers 501.
func New(_ module.Deps) module.Module {
	return module.Stub{ModuleName: "bank", Prefixes: []string{"/providers", "/bank"}}
}
