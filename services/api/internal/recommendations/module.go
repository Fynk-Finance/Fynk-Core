package recommendations

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// New returns the recommendations module. Until M11 implements it, every route answers 501.
func New(_ module.Deps) module.Module {
	return module.Stub{ModuleName: "recommendations", Prefixes: []string{"/recommendations"}}
}
