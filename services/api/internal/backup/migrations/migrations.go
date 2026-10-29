// Package migrations holds the Postgres migrations of the backup schema (M2).
// The runner applies them with the connection's search_path set to backup, but the SQL
// qualifies every name anyway.
package migrations

import "embed"

// FS is the backup schema's migrations (golang-migrate files at the root).
//
//go:embed *.sql
var FS embed.FS
