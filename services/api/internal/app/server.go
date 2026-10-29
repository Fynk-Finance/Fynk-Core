package app

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/problem"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/requestid"
)

// Pinger is a dependency /readyz checks, such as Postgres or Redis.
type Pinger interface {
	Ping(ctx context.Context) error
}

// Option configures NewRouter.
type Option func(*routerConfig)

type routerConfig struct {
	auditVerifier AuditVerifier
}

// AuditVerifier verifies the audit trail integrity.
type AuditVerifier interface {
	Verify(ctx context.Context) (audit.VerificationResult, error)
}

// WithAuditVerifier configures the verifier used by GET /internal/audit/verify.
func WithAuditVerifier(v AuditVerifier) Option {
	return func(c *routerConfig) {
		c.auditVerifier = v
	}
}

// readyTimeout bounds each readiness check.
const readyTimeout = 2 * time.Second

// NewRouter builds the HTTP handler: /healthz, /readyz, /internal, and every module under /v1.
// checks maps a dependency name ("postgres", "redis") to its Pinger.
func NewRouter(log *slog.Logger, modules []Module, checks map[string]Pinger, opts ...Option) (http.Handler, error) {
	var cfg routerConfig
	for _, opt := range opts {
		opt(&cfg)
	}

	seen := map[string]bool{}
	for _, m := range modules {
		if seen[m.Name()] {
			return nil, fmt.Errorf("app: module %q is listed twice", m.Name())
		}
		seen[m.Name()] = true
	}

	r := chi.NewRouter()
	r.Use(requestid.Middleware, accessLog(log), middleware.Recoverer)
	r.NotFound(problem.NotFound)
	r.MethodNotAllowed(problem.MethodNotAllowed)

	r.Get("/healthz", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Get("/readyz", readyz(checks))

	if cfg.auditVerifier != nil {
		r.Route("/internal", func(ir chi.Router) {
			ir.Use(auth.Require)
			ir.Get("/audit/verify", func(w http.ResponseWriter, r *http.Request) {
				res, err := cfg.auditVerifier.Verify(r.Context())
				w.Header().Set("Content-Type", "application/json; charset=utf-8")
				if err != nil || !res.Valid {
					w.WriteHeader(http.StatusInternalServerError)
					_ = json.NewEncoder(w).Encode(res)
					return
				}
				w.WriteHeader(http.StatusOK)
				_ = json.NewEncoder(w).Encode(res)
			})
		})
	}

	r.Route("/v1", func(v chi.Router) {
		for _, m := range modules {
			m.Routes(v)
		}
	})
	return r, nil
}

func readyz(checks map[string]Pinger) http.HandlerFunc {
	names := make([]string, 0, len(checks))
	for name := range checks {
		names = append(names, name)
	}
	sort.Strings(names)

	return func(w http.ResponseWriter, r *http.Request) {
		var failed []string
		for _, name := range names {
			ctx, cancel := context.WithTimeout(r.Context(), readyTimeout)
			err := checks[name].Ping(ctx)
			cancel()
			if err != nil {
				failed = append(failed, name)
			}
		}
		if len(failed) > 0 {
			// Only the names of the failing dependencies: errors can contain hosts or users.
			problem.Write(w, problem.New(http.StatusServiceUnavailable, "not_ready", "Not ready",
				"Unavailable: "+strings.Join(failed, ", ")))
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	}
}

// accessLog writes one line per request. Never the query string or headers (CLAUDE.md, Security rules).
func accessLog(log *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			next.ServeHTTP(ww, r)
			log.LogAttrs(r.Context(), slog.LevelInfo, "http",
				slog.String("request_id", requestid.From(r.Context())),
				slog.String("method", r.Method),
				slog.String("path", r.URL.Path),
				slog.Int("status", ww.Status()),
				slog.Duration("duration", time.Since(start)),
			)
		})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
