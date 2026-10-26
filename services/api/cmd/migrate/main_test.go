package main

import (
	"context"
	"io"
	"log/slog"
	"strings"
	"testing"
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
	// No module has SQL yet, so no database connection is attempted.
	vars := env(map[string]string{
		"APP_ENV": "local", "DATABASE_URL": "postgres://unused", "REDIS_URL": "redis://unused",
	})
	for _, cmd := range []string{"up", "status"} {
		if err := run(context.Background(), []string{cmd}, vars, quiet); err != nil {
			t.Errorf("%s: %v", cmd, err)
		}
	}
}
