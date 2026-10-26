package app

import (
	auditmigrations "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/migrations"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
)

// MigrationSources lists every Postgres schema with its migrations: one per module in mods,
// plus audit, which owns a schema but no routes. M0 created this list once, like All(), so
// nobody adds lines later. A source without SQL files is skipped by the runner.
func MigrationSources(mods []Module) []migrate.Source {
	srcs := make([]migrate.Source, 0, len(mods)+1)
	for _, m := range mods {
		srcs = append(srcs, migrate.Source{Schema: m.Name(), FS: m.Migrations()})
	}
	return append(srcs, migrate.Source{Schema: "audit", FS: auditmigrations.FS})
}
