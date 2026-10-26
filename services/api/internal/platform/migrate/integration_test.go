//go:build integration

// Runs against a real Postgres: DATABASE_URL=postgres://... go test -tags integration ./internal/platform/migrate/
// make dev starts one on localhost:5432 (see docs/local-dev.md).
package migrate

import (
	"context"
	"database/sql"
	"os"
	"testing"
	"testing/fstest"
)

func TestTwoSchemasWithTheSameVersionDoNotCollide(t *testing.T) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx := context.Background()
	db, err := sql.Open("pgx", dbURL)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	schemas := []string{"it_alpha", "it_beta"}
	cleanup := func() {
		for _, s := range schemas {
			_, _ = db.ExecContext(ctx, "DROP SCHEMA IF EXISTS "+s+" CASCADE")
		}
	}
	cleanup()
	t.Cleanup(cleanup)

	for _, s := range schemas {
		src := Source{Schema: s, FS: fstest.MapFS{
			"1_create_items.up.sql":   {Data: []byte("CREATE TABLE items (id int PRIMARY KEY);")},
			"1_create_items.down.sql": {Data: []byte("DROP TABLE items;")},
		}}
		for run := 1; run <= 2; run++ { // the second run must be a no-op
			res, err := Up(ctx, dbURL, src)
			if err != nil {
				t.Fatalf("%s run %d: %v", s, run, err)
			}
			if res.Version != 1 || res.Dirty || res.Skipped {
				t.Fatalf("%s run %d: %+v, want version 1", s, run, res)
			}
		}
		var tables int
		err := db.QueryRowContext(ctx,
			`SELECT count(*) FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('items', $2)`,
			s, s+"_migrations").Scan(&tables)
		if err != nil || tables != 2 {
			t.Fatalf("%s: found %d of items and %s_migrations (%v)", s, tables, s, err)
		}
		st, err := Status(ctx, dbURL, src)
		if err != nil || st.Version != 1 {
			t.Fatalf("%s: Status = %+v, %v", s, st, err)
		}
	}
}
