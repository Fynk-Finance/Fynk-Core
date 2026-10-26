package market

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// New returns the market module. Until M15 implements it, every route answers 501.
func New(_ module.Deps) module.Module {
	return module.Stub{ModuleName: "market", Prefixes: []string{"/market"}}
}
