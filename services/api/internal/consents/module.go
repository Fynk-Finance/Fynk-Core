package consents

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// New returns the consents module. Until M4 implements it, every route answers 501.
func New(_ module.Deps) module.Module {
	return module.Stub{ModuleName: "consents", Prefixes: []string{"/consent-texts", "/consents"}}
}
