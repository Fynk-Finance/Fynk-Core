package identity

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// New returns the identity module. Until M1 implements it, every route answers 501.
func New(_ module.Deps) module.Module {
	return module.Stub{ModuleName: "identity", Prefixes: []string{"/me", "/devices"}}
}
