// Package migrations holds the Postgres migrations of the consents schema (M4).
package migrations

import "embed"

// FS is the consents schema's migrations (golang-migrate files at the root).
//
//go:embed *.sql
var FS embed.FS
