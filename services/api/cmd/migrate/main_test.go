package main

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/app"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
)

var quiet = slog.New(slog.NewJSONHandler(io.Discard, nil))

func env(m map[string]string) func(string) string { return func(k string) string { return m[k] } }

func TestRunRejectsUnknownCommand(t *testing.T) {
	err := run(context.Background(), []string{"down"}, env(nil), quiet)
	if err == nil || !strings.Contains(err.Error(), "unknown command") {
		t.Fatalf("err = %v, want unknown command", err)
	}
}

func TestRunNeedsConfig(t *testing.T) {
	err := run(context.Background(), nil, env(nil), quiet)
	if err == nil || !strings.Contains(err.Error(), "APP_ENV") {
		t.Fatalf("err = %v, want missing APP_ENV", err)
	}
}

func TestRunSkipsEveryModuleWithoutMigrations(t *testing.T) {
	// The database cannot be reached, so exactly the schemas that have SQL fail, each with its
	// own error line ("<schema>: ..."), and the schemas without SQL never try to connect.
	vars := env(map[string]string{
		"APP_ENV": "local", "DATABASE_URL": "postgres://unused", "REDIS_URL": "redis://unused",
	})
	for _, cmd := range []string{"up", "status"} {
		err := run(context.Background(), []string{cmd}, vars, quiet)
		failed := map[string]bool{}
		if err != nil {
			for _, line := range strings.Split(err.Error(), "\n") {
				if schema, _, ok := strings.Cut(line, ": "); ok {
					failed[schema] = true
				}
			}
		}
		for _, src := range app.MigrationSources(app.All(app.Deps{})) {
			hasSQL, herr := migrate.HasSQL(src.FS)
			if herr != nil {
				t.Fatal(herr)
			}
			if failed[src.Schema] != hasSQL {
				t.Errorf("%s: schema %s has SQL %v but tried to connect %v (%v)", cmd, src.Schema, hasSQL, failed[src.Schema], err)
			}
		}
	}
}
