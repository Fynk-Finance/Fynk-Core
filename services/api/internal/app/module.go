package app

import "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"

// Module and Deps are defined in internal/platform/module to avoid an import cycle
// (this package imports every module). These aliases keep app.Module and app.Deps
// as written in the shared contracts, section 4.1.
type (
	Module = module.Module
	Deps   = module.Deps
)
