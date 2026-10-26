// Package migrations holds the Postgres migrations of the audit schema (M13).
//
// Audit is not an HTTP module, so it is not in app.All(). internal/app lists this FS once
// as a migration source, so M13 adds tables here without editing internal/app.
// M13 replaces the placeholder below with:
//
//	//go:embed *.sql
//	var FS embed.FS
package migrations

import (
	"io/fs"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/module"
)

// FS is the audit schema's migrations (golang-migrate files at the root).
var FS fs.FS = module.NoMigrations
