package privacy

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// New returns the privacy module. Until M13 implements it, every route answers 501.
func New(_ module.Deps) module.Module {
	return module.Stub{ModuleName: "privacy", Prefixes: []string{"/privacy"}}
}
