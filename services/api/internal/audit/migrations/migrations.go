// Package migrations holds the Postgres migrations of the audit schema (M13).
package migrations

import (
	"embed"
	"io/fs"
)

//go:embed *.sql
var sqlFiles embed.FS

// FS is the audit schema's migrations.
var FS fs.FS = sqlFiles
