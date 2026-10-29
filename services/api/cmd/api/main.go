// Command api is the Fynk backend. "api healthcheck" checks a running instance (Docker).
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/app"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit"
	identityports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/db"
	fynklog "github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/log"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/redis"
)

func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		os.Exit(healthcheck(context.Background(), http.DefaultClient, healthURL(os.Getenv("PORT"))))
	}
	if len(os.Args) > 2 && os.Args[1] == "audit" && os.Args[2] == "verify" {
		os.Exit(auditVerify())
	}
	logger := fynklog.New(os.Stdout, slog.LevelInfo)
	if err := run(logger); err != nil {
		logger.Error("api stopped", "error", err)
		os.Exit(1)
	}
}

func auditVerify() int {
	logger := fynklog.New(os.Stdout, slog.LevelInfo)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cfg, err := config.Load(os.Getenv)
	if err != nil {
		fmt.Fprintf(os.Stderr, "audit verify: config load error: %v\n", err)
		return 1
	}

	pool, err := db.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "audit verify: db connection error: %v\n", err)
		return 1
	}
	defer pool.Close()

	store := audit.New(pool, logger, clock.System{})
	res, err := store.Verify(ctx)
	if err != nil || !res.Valid {
		fmt.Fprintf(os.Stderr, "audit verification failed: %v (details: %+v)\n", err, res)
		return 1
	}

	fmt.Printf("audit chain valid: %d events verified, head hash: %s\n", res.Count, res.HeadHash)
	return 0
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

	verifier, err := newVerifier(cfg, logger, identityports.NewDeviceChecker(pool, clock.System{}))
	if err != nil {
		return err
	}
	auth.Install(verifier)

	auditStore := audit.New(pool, logger, clock.System{})
	deps := app.Deps{
		DB:     pool,
		Redis:  rdb,
		Audit:  auditStore,
		Clock:  clock.System{},
		Log:    logger,
		Config: cfg,
	}
	handler, err := app.NewRouter(
		logger,
		app.All(deps),
		map[string]app.Pinger{
			"postgres": pool,
			"redis":    redis.Pinger{Client: rdb},
		},
		app.WithAuditVerifier(auditStore),
	)
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
