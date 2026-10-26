// Command migrate applies the Postgres migrations of every backend module.
//
//	migrate          same as "migrate up"
//	migrate up       apply every pending migration, schema by schema
//	migrate status   print each schema's version without changing anything
//
// It reads APP_ENV, DATABASE_URL and REDIS_URL like the API. make migrate runs it in Docker.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/app"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	fynklog "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/log"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
)

func main() {
	logger := fynklog.New(os.Stdout, slog.LevelInfo)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, os.Args[1:], os.Getenv, logger); err != nil {
		logger.Error("migrate failed", "error", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, getenv func(string) string, logger *slog.Logger) error {
	cmd := "up"
	if len(args) > 0 {
		cmd = args[0]
	}
	var step func(context.Context, string, migrate.Source) (migrate.Result, error)
	switch cmd {
	case "up":
		step = migrate.Up
	case "status":
		step = migrate.Status
	default:
		return fmt.Errorf("unknown command %q (use up or status)", cmd)
	}

	cfg, err := config.Load(getenv)
	if err != nil {
		return err
	}
	// Module constructors only keep their dependencies, so empty Deps are enough to read
	// each module's name and migrations.
	srcs := app.MigrationSources(app.All(app.Deps{Config: cfg, Log: logger}))

	var errs []error
	for _, src := range srcs {
		res, err := step(ctx, cfg.DatabaseURL, src)
		switch {
		case err != nil:
			errs = append(errs, err)
		case res.Skipped:
			logger.Info("no migrations yet", "schema", res.Schema)
		case res.Dirty:
			errs = append(errs, fmt.Errorf("%s: version %d is dirty, fix it by hand", res.Schema, res.Version))
		default:
			logger.Info("schema "+cmd, "schema", res.Schema, "version", res.Version)
		}
	}
	return errors.Join(errs...)
}
