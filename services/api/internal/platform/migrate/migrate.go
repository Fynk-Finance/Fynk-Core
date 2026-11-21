// Package migrate runs the Postgres migrations of one backend module with golang-migrate.
//
// Each module owns one schema with its own name and one migrations table named
// <schema>_migrations inside it (shared contracts, section 4), so two modules never share
// a version sequence. A module's Migrations() FS holds golang-migrate files at its root,
// for example 1_create_devices.up.sql and 1_create_devices.down.sql. Unqualified names in
// the SQL land in the module's schema, because the connection's search_path is that schema.
package migrate

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"regexp"

	"github.com/golang-migrate/migrate/v4"
	pgxmigrate "github.com/golang-migrate/migrate/v4/database/pgx/v5"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5"
	_ "github.com/jackc/pgx/v5/stdlib" // registers the "pgx" database/sql driver
)

// Source is the migrations of one schema.
type Source struct {
	Schema string
	FS     fs.FS
}

// Result is the state of one schema after Up or Status.
type Result struct {
	Schema  string
	Skipped bool // no .sql files yet
	Version uint // 0 when nothing has run
	Dirty   bool // a migration failed halfway and needs a manual fix
}

var schemaName = regexp.MustCompile(`^[a-z][a-z0-9_]{0,40}$`)

// ValidSchema reports whether name is a safe schema name (lowercase, digits, underscores).
func ValidSchema(name string) bool { return schemaName.MatchString(name) }

// HasSQL reports whether fsys holds at least one .sql file at its root.
func HasSQL(fsys fs.FS) (bool, error) {
	if fsys == nil {
		return false, nil
	}
	matches, err := fs.Glob(fsys, "*.sql")
	if err != nil {
		return false, err
	}
	return len(matches) > 0, nil
}

// Up applies every pending migration of src. A source without SQL is skipped and
// its schema is not created.
func Up(ctx context.Context, databaseURL string, src Source) (Result, error) {
	return run(ctx, databaseURL, src, true)
}

// Status reads the current version of src without applying any migration. Like Up, it
// creates the empty schema and its migrations table if they are missing.
func Status(ctx context.Context, databaseURL string, src Source) (Result, error) {
	return run(ctx, databaseURL, src, false)
}

func run(ctx context.Context, databaseURL string, src Source, apply bool) (Result, error) {
	res := Result{Schema: src.Schema}
	if !ValidSchema(src.Schema) {
		return res, fmt.Errorf("invalid schema name %q", src.Schema)
	}
	ok, err := HasSQL(src.FS)
	if err != nil {
		return res, fmt.Errorf("%s: read migrations: %w", src.Schema, err)
	}
	if !ok {
		res.Skipped = true
		return res, nil
	}

	dsn, err := withSearchPath(databaseURL, src.Schema)
	if err != nil {
		return res, err
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return res, fmt.Errorf("%s: open database: %w", src.Schema, err)
	}
	// Both modes need the schema: the driver creates its migrations table when it connects.
	if _, err := db.ExecContext(ctx, "CREATE SCHEMA IF NOT EXISTS "+pgx.Identifier{src.Schema}.Sanitize()); err != nil {
		_ = db.Close()
		return res, fmt.Errorf("%s: create schema: %w", src.Schema, err)
	}

	driver, err := pgxmigrate.WithInstance(db, &pgxmigrate.Config{
		SchemaName:      src.Schema,
		MigrationsTable: src.Schema + "_migrations",
	})
	if err != nil {
		_ = db.Close()
		return res, fmt.Errorf("%s: migrations driver: %w", src.Schema, err)
	}
	source, err := iofs.New(src.FS, ".")
	if err != nil {
		_ = driver.Close()
		return res, fmt.Errorf("%s: migrations source: %w", src.Schema, err)
	}
	m, err := migrate.NewWithInstance("iofs", source, "pgx5", driver)
	if err != nil {
		_ = source.Close()
		_ = driver.Close()
		return res, fmt.Errorf("%s: migrate: %w", src.Schema, err)
	}
	defer func() { _, _ = m.Close() }()

	if apply {
		if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
			return res, fmt.Errorf("%s: up: %w", src.Schema, err)
		}
	}
	v, dirty, err := m.Version()
	switch {
	case errors.Is(err, migrate.ErrNilVersion):
	case err != nil:
		return res, fmt.Errorf("%s: version: %w", src.Schema, err)
	default:
		res.Version, res.Dirty = v, dirty
	}
	return res, nil
}

// withSearchPath sets the connection's search_path to schema. It never logs the URL,
// which holds the database password.
func withSearchPath(databaseURL, schema string) (string, error) {
	u, err := url.Parse(databaseURL)
	if err != nil || (u.Scheme != "postgres" && u.Scheme != "postgresql") {
		return "", errors.New("DATABASE_URL must be a postgres:// URL")
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	return u.String(), nil
}
