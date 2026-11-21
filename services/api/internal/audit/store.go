package audit

import (
	"bytes"
	"context"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/audit/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
)

// advisoryLockKey serializes append operations on audit.events to ensure a single, linear hash chain.
const advisoryLockKey = int64(8472918471928471)

// VerificationResult describes the outcome of an audit trail verification.
type VerificationResult struct {
	Valid      bool   `json:"valid"`
	Count      int64  `json:"count"`
	HeadHash   string `json:"head_hash,omitempty"`
	BrokenAtID int64  `json:"broken_at_id,omitempty"`
	Reason     string `json:"reason,omitempty"`
}

// Store is an append-only, hash-chained audit recorder backed by PostgreSQL.
type Store struct {
	pool  *pgxpool.Pool
	log   *slog.Logger
	clock clock.Clock
}

// New creates an audit Store implementing ports.Recorder.
func New(pool *pgxpool.Pool, log *slog.Logger, clk clock.Clock) *Store {
	if clk == nil {
		clk = clock.System{}
	}
	return &Store{
		pool:  pool,
		log:   log,
		clock: clk,
	}
}

// Record appends an audit event to audit.events with cryptographic hash chaining.
func (s *Store) Record(ctx context.Context, e ports.Event) error {
	if err := ValidateEvent(e); err != nil {
		return err
	}

	if e.At.IsZero() {
		e.At = s.clock.Now()
	}
	e.At = e.At.UTC().Truncate(time.Microsecond)

	var deviceUUID *string
	normDeviceID := ""
	if e.DeviceID != "" {
		parsed, err := uuid.Parse(e.DeviceID)
		if err != nil {
			return fmt.Errorf("%w: %q", ErrInvalidDeviceID, e.DeviceID)
		}
		normDeviceID = parsed.String()
		deviceUUID = &normDeviceID
	}

	var userCol *string
	if e.UserID != "" {
		userCol = &e.UserID
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("audit: begin tx: %w", err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Acquire advisory transaction lock to serialize audit event insertions.
	if _, err := tx.Exec(ctx, "SELECT pg_advisory_xact_lock($1)", advisoryLockKey); err != nil {
		return fmt.Errorf("audit: acquire advisory lock: %w", err)
	}

	// Fetch hash of the most recent row.
	var prevHash []byte
	row := tx.QueryRow(ctx, "SELECT hash FROM audit.events ORDER BY id DESC LIMIT 1")
	err = row.Scan(&prevHash)
	if errors.Is(err, pgx.ErrNoRows) {
		// Genesis row uses 32 zero bytes.
		prevHash = make([]byte, 32)
	} else if err != nil {
		return fmt.Errorf("audit: fetch prev hash: %w", err)
	}

	canonicalRow := BuildCanonicalRow(e.Type, e.UserID, normDeviceID, e.At, e.Meta)
	canonicalBytes, err := CanonicalJSON(canonicalRow)
	if err != nil {
		return fmt.Errorf("audit: canonical json: %w", err)
	}

	currentHash := ComputeHash(prevHash, canonicalBytes)

	metaJSON, err := json.Marshal(canonicalRow.Meta)
	if err != nil {
		return fmt.Errorf("audit: marshal meta: %w", err)
	}

	const insertQuery = `
		INSERT INTO audit.events (type, user_id, device_id, at, meta, prev_hash, hash)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err = tx.Exec(ctx, insertQuery, e.Type, userCol, deviceUUID, e.At, metaJSON, prevHash, currentHash)
	if err != nil {
		return fmt.Errorf("audit: insert event: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("audit: commit event: %w", err)
	}

	if s.log != nil {
		s.log.DebugContext(ctx, "audit event recorded",
			slog.String("type", e.Type),
			slog.String("user_id", e.UserID),
			slog.String("hash", hex.EncodeToString(currentHash)),
		)
	}
	return nil
}

// Verify iterates through all events in audit.events and validates the cryptographic hash chain.
func (s *Store) Verify(ctx context.Context) (VerificationResult, error) {
	const selectQuery = `
		SELECT id, type, COALESCE(user_id, ''), COALESCE(device_id::text, ''), at, meta, prev_hash, hash
		FROM audit.events
		ORDER BY id ASC
	`
	rows, err := s.pool.Query(ctx, selectQuery)
	if err != nil {
		return VerificationResult{}, fmt.Errorf("audit: query events: %w", err)
	}
	defer rows.Close()

	var count int64
	expectedPrevHash := make([]byte, 32)

	for rows.Next() {
		var (
			id       int64
			typ      string
			userID   string
			deviceID string
			at       time.Time
			metaRaw  []byte
			prevHash []byte
			hash     []byte
		)

		if err := rows.Scan(&id, &typ, &userID, &deviceID, &at, &metaRaw, &prevHash, &hash); err != nil {
			return VerificationResult{}, fmt.Errorf("audit: scan row: %w", err)
		}

		if !bytes.Equal(prevHash, expectedPrevHash) {
			res := VerificationResult{
				Valid:      false,
				Count:      count,
				BrokenAtID: id,
				Reason:     fmt.Sprintf("prev_hash mismatch at id %d", id),
			}
			return res, fmt.Errorf("audit: %s", res.Reason)
		}

		var meta map[string]string
		if len(metaRaw) > 0 {
			if err := json.Unmarshal(metaRaw, &meta); err != nil {
				res := VerificationResult{
					Valid:      false,
					Count:      count,
					BrokenAtID: id,
					Reason:     fmt.Sprintf("unmarshal meta at id %d: %v", id, err),
				}
				return res, fmt.Errorf("audit: %s", res.Reason)
			}
		}

		canonicalRow := BuildCanonicalRow(typ, userID, deviceID, at, meta)
		canonicalBytes, err := CanonicalJSON(canonicalRow)
		if err != nil {
			res := VerificationResult{
				Valid:      false,
				Count:      count,
				BrokenAtID: id,
				Reason:     fmt.Sprintf("build canonical json at id %d: %v", id, err),
			}
			return res, fmt.Errorf("audit: %s", res.Reason)
		}

		computedHash := ComputeHash(prevHash, canonicalBytes)
		if !bytes.Equal(hash, computedHash) {
			res := VerificationResult{
				Valid:      false,
				Count:      count,
				BrokenAtID: id,
				Reason:     fmt.Sprintf("hash mismatch at id %d", id),
			}
			return res, fmt.Errorf("audit: %s", res.Reason)
		}

		expectedPrevHash = hash
		count++
	}

	if err := rows.Err(); err != nil {
		return VerificationResult{}, fmt.Errorf("audit: rows iteration: %w", err)
	}

	headHex := ""
	if count > 0 {
		headHex = hex.EncodeToString(expectedPrevHash)
	}

	return VerificationResult{
		Valid:    true,
		Count:    count,
		HeadHash: headHex,
	}, nil
}
