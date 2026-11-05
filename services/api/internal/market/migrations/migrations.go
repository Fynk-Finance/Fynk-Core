// Package migrations holds the Postgres migrations of the market schema (M15).
package migrations

import "embed"

// FS is the market schema's migrations (golang-migrate files at the root).
//
//go:embed *.sql
var FS embed.FS
