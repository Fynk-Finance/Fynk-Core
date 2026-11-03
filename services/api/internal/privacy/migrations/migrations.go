// Package migrations holds the Postgres migrations of the privacy schema (M13).
package migrations

import "embed"

// FS is the privacy schema's migrations.
//
//go:embed *.sql
var FS embed.FS
