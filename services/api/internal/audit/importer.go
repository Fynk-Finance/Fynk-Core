package audit

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	identityports "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// safetyMargin is how far back before the cursor's last_event_time the importer queries,
// catching events that had slight arrival latency or clock jitter in Keycloak.
const safetyMargin = 5 * time.Minute

// retentionProcessedEvents determines how long event IDs are remembered for deduplication.
const retentionProcessedEvents = 7 * 24 * time.Hour

// KeycloakImporter periodically reads new user events from Keycloak and records them in audit.events.
type KeycloakImporter struct {
	pool     *pgxpool.Pool
	recorder ports.Recorder
	reader   identityports.AuthEvents
	log      *slog.Logger
	clock    clock.Clock
}

// NewKeycloakImporter creates an importer.
func NewKeycloakImporter(
	pool *pgxpool.Pool,
	rec ports.Recorder,
	reader identityports.AuthEvents,
	log *slog.Logger,
	clk clock.Clock,
) *KeycloakImporter {
	if clk == nil {
		clk = clock.System{}
	}
	return &KeycloakImporter{
		pool:     pool,
		recorder: rec,
		reader:   reader,
		log:      log,
		clock:    clk,
	}
}

// ImportOnce runs one synchronization cycle. It returns the count of new events recorded.
func (imp *KeycloakImporter) ImportOnce(ctx context.Context) (int, error) {
	if imp.reader == nil {
		return 0, nil
	}

	tx, err := imp.pool.Begin(ctx)
	if err != nil {
		return 0, fmt.Errorf("audit import: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Lock the cursor row to prevent concurrent workers from overlapping.
	var lastEventTime time.Time
	err = tx.QueryRow(ctx, "SELECT last_event_time FROM audit.keycloak_events_cursor WHERE id = 1 FOR UPDATE").Scan(&lastEventTime)
	if err != nil {
		return 0, fmt.Errorf("audit import: read cursor: %w", err)
	}

	// Determine start window
	querySince := lastEventTime.Add(-safetyMargin)
	if lastEventTime.IsZero() || lastEventTime.Unix() <= 0 {
		// First run: read events from the past 24 hours
		querySince = imp.clock.Now().Add(-24 * time.Hour)
	}

	rawEvents, err := imp.reader.Events(ctx, querySince)
	if err != nil {
		return 0, fmt.Errorf("audit import: fetch keycloak events: %w", err)
	}

	// Filter for relevant authentication event types
	filtered := make([]identityports.AuthEvent, 0, len(rawEvents))
	for _, e := range rawEvents {
		switch e.Type {
		case "LOGIN", "LOGIN_ERROR", "RESET_PASSWORD", "UPDATE_PASSWORD":
			filtered = append(filtered, e)
		}
	}

	// Sort chronologically ascending
	sort.Slice(filtered, func(i, j int) bool {
		return filtered[i].Time.Before(filtered[j].Time)
	})

	now := imp.clock.Now().UTC()
	imported := 0
	maxTime := lastEventTime

	for _, e := range filtered {
		// Check if already processed
		var exists int
		err := tx.QueryRow(ctx, "SELECT 1 FROM audit.keycloak_processed_events WHERE event_id = $1", e.ID).Scan(&exists)
		if err == nil {
			continue // already processed
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return imported, fmt.Errorf("audit import: check processed event: %w", err)
		}

		auditEvt, ok := mapKeycloakEvent(e)
		if !ok {
			continue
		}

		if err := imp.recorder.Record(ctx, auditEvt); err != nil {
			return imported, fmt.Errorf("audit import: record event %s: %w", e.ID, err)
		}

		_, err = tx.Exec(ctx,
			"INSERT INTO audit.keycloak_processed_events (event_id, event_time, processed_at) VALUES ($1, $2, $3)",
			e.ID, e.Time, now,
		)
		if err != nil {
			return imported, fmt.Errorf("audit import: mark processed event: %w", err)
		}

		if e.Time.After(maxTime) {
			maxTime = e.Time
		}
		imported++
	}

	// Update cursor
	if maxTime.After(lastEventTime) {
		_, err = tx.Exec(ctx,
			"UPDATE audit.keycloak_events_cursor SET last_event_time = $1, updated_at = $2 WHERE id = 1",
			maxTime, now,
		)
		if err != nil {
			return imported, fmt.Errorf("audit import: update cursor: %w", err)
		}
	}

	// Prune old processed events older than retention period
	cutoff := now.Add(-retentionProcessedEvents)
	_, _ = tx.Exec(ctx, "DELETE FROM audit.keycloak_processed_events WHERE processed_at < $1", cutoff)

	if err := tx.Commit(ctx); err != nil {
		return imported, fmt.Errorf("audit import: commit: %w", err)
	}

	return imported, nil
}

// Run executes ImportOnce immediately and on each interval until ctx is done.
func (imp *KeycloakImporter) Run(ctx context.Context, every time.Duration) {
	ticker := time.NewTicker(every)
	defer ticker.Stop()

	for {
		if n, err := imp.ImportOnce(ctx); err != nil {
			if imp.log != nil {
				imp.log.WarnContext(ctx, "keycloak audit events import failed", "error", err)
			}
		} else if n > 0 && imp.log != nil {
			imp.log.InfoContext(ctx, "keycloak audit events imported", "count", n)
		}

		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// mapKeycloakEvent maps a Keycloak AuthEvent to an audit ports.Event, ensuring no sensitive data leaks.
func mapKeycloakEvent(e identityports.AuthEvent) (ports.Event, bool) {
	switch e.Type {
	case "LOGIN":
		meta := map[string]string{
			"status": "success",
		}
		if e.IPAddress != "" {
			meta["ip"] = e.IPAddress
		}
		if m, ok := e.Details["auth_method"]; ok && m != "" {
			meta["auth_method"] = m
		}
		return ports.Event{
			Type:   ports.AuthLogin,
			UserID: e.UserID,
			At:     e.Time,
			Meta:   meta,
		}, true

	case "LOGIN_ERROR":
		meta := map[string]string{
			"status": "failed",
		}
		if e.IPAddress != "" {
			meta["ip"] = e.IPAddress
		}
		reason := e.Error
		if r, ok := e.Details["reason"]; ok && r != "" {
			reason = r
		}
		if reason != "" {
			meta["reason"] = reason
			meta["error_code"] = reason
		}
		return ports.Event{
			Type:   ports.AuthLoginFailed,
			UserID: e.UserID,
			At:     e.Time,
			Meta:   meta,
		}, true

	case "RESET_PASSWORD", "UPDATE_PASSWORD":
		meta := map[string]string{
			"status": "success",
		}
		if e.IPAddress != "" {
			meta["ip"] = e.IPAddress
		}
		return ports.Event{
			Type:   ports.AuthPasswordReset,
			UserID: e.UserID,
			At:     e.Time,
			Meta:   meta,
		}, true

	default:
		return ports.Event{}, false
	}
}
