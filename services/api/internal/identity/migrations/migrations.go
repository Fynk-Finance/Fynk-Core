// Package migrations holds the Postgres migrations of the identity schema (M1).
// The runner applies them with the connection's search_path set to identity, but the SQL
// qualifies every name anyway.
package migrations

import "embed"

// FS is the identity schema's migrations (golang-migrate files at the root).
//
//go:embed *.sql
var FS embed.FS
