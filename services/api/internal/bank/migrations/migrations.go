// Package migrations holds the Postgres migrations of the bank schema (M5).
package migrations

import "embed"

// FS is the bank schema's migrations (golang-migrate files at the root).
//
//go:embed *.sql
var FS embed.FS
