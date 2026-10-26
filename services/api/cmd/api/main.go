// Command api is the Fynk backend.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/app"
	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/db"
	fynklog "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/log"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/redis"
)

func main() {
	logger := fynklog.New(os.Stdout, slog.LevelInfo)
	if err := run(logger); err != nil {
		logger.Error("api stopped", "error", err)
		os.Exit(1)
	}
}

func run(logger *slog.Logger) error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg, err := config.Load(os.Getenv)
	if err != nil {
		return err
	}

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	rdb, err := redis.Open(cfg.RedisURL)
	if err != nil {
		return err
	}
	defer func() { _ = rdb.Close() }()

	// M1 replaces the dev verifier with the Keycloak one here.
	auth.Install(auth.DevVerifier{Env: cfg.AppEnv})

	deps := app.Deps{
		DB:     pool,
		Redis:  rdb,
		Audit:  audit.NewLogRecorder(logger), // M13 replaces it with the audit store
		Clock:  clock.System{},
		Log:    logger,
		Config: cfg,
	}
	handler, err := app.NewRouter(logger, app.All(deps), map[string]app.Pinger{
		"postgres": pool,
		"redis":    redis.Pinger{Client: rdb},
	})
	if err != nil {
		return err
	}

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	errs := make(chan error, 1)
	go func() {
		logger.Info("api listening", "addr", srv.Addr, "env", string(cfg.AppEnv))
		errs <- srv.ListenAndServe()
	}()

	select {
	case err := <-errs:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		logger.Info("api shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}
