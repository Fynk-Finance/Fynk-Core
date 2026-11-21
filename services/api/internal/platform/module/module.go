// Package module defines what every backend module provides (shared contracts, section 4.1).
//
// It lives in platform instead of internal/app because internal/app imports every module:
// if modules imported internal/app back, Go would report an import cycle. internal/app
// re-exports these types, so app.Module and app.Deps still work.
package module

import (
	"embed"
	"io/fs"
	"log/slog"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	audit "github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/config"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
)

// Module is one backend module.
type Module interface {
	Name() string
	Routes(r chi.Router) // mounted under /v1
	Migrations() fs.FS   // embedded SQL, own Postgres schema
}

// Deps is what every module receives.
type Deps struct {
	DB     *pgxpool.Pool
	Redis  *redis.Client
	Audit  audit.Recorder
	Clock  clock.Clock
	Log    *slog.Logger
	Config config.Config
}

// NoMigrations is an empty migrations FS for modules without tables yet.
var NoMigrations fs.FS = embed.FS{}

// Stub is the placeholder M0 gives every module until its owner implements it:
// every route under its path prefixes requires a token and answers 501 problem JSON.
type Stub struct {
	ModuleName string
	Prefixes   []string // e.g. "/consents", mounted under /v1
}

// Name implements Module.
func (s Stub) Name() string { return s.ModuleName }

// Routes implements Module.
func (s Stub) Routes(r chi.Router) {
	h := auth.Require(http.HandlerFunc(problem.NotImplemented))
	for _, p := range s.Prefixes {
		r.Handle(p, h)
		r.Handle(p+"/*", h)
	}
}

// Migrations implements Module.
func (s Stub) Migrations() fs.FS { return NoMigrations }
