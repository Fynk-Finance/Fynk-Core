package app

import (
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/backup"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/bank"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/catalog"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/market"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/recommendations"
)

// All returns every backend module. M0 created this list once with one entry per module.
// Nobody adds lines later, so it never conflicts (CLAUDE.md, Conflict rules).
func All(d Deps) []Module {
	return []Module{
		identity.New(d), backup.New(d), consents.New(d), bank.New(d),
		catalog.New(d), recommendations.New(d), privacy.New(d), market.New(d),
	}
}
