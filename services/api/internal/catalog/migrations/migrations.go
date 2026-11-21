// Package migrations holds the Postgres migrations of the catalog schema (M9).
package migrations

import "embed"

// FS is the catalog schema's migrations (golang-migrate files at the root).
//
//go:embed *.sql
var FS embed.FS
