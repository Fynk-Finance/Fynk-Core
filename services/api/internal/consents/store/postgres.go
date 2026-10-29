// Package store keeps consents and consent texts in the Postgres schema consents.
package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/consents/domain"
)

// Postgres implements service.Store.
type Postgres struct {
	db *pgxpool.Pool
}

// New returns the store.
func New(db *pgxpool.Pool) *Postgres { return &Postgres{db: db} }

const consentColumns = `id::text, user_id, device_id::text, provider, scopes, purpose, term_days, status,
	text_version, evidence, provider_consent_id, created_at, granted_at, expires_at, revoked_at, revoked_reason`

// CurrentText returns the latest published text.
func (p *Postgres) CurrentText(ctx context.Context) (domain.Text, error) {
	return p.text(ctx, `SELECT version, body_md, sha256, published_at FROM consents.consent_texts
		ORDER BY published_at DESC LIMIT 1`)
}

// TextByVersion returns one text, or domain.ErrUnknownTextVersion.
func (p *Postgres) TextByVersion(ctx context.Context, version string) (domain.Text, error) {
	return p.text(ctx, `SELECT version, body_md, sha256, published_at FROM consents.consent_texts
		WHERE version = $1`, version)
}

func (p *Postgres) text(ctx context.Context, sql string, args ...any) (domain.Text, error) {
	var t domain.Text
	err := p.db.QueryRow(ctx, sql, args...).Scan(&t.Version, &t.BodyMD, &t.SHA256, &t.PublishedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Text{}, domain.ErrUnknownTextVersion
	}
	if err != nil {
		return domain.Text{}, fmt.Errorf("consents: read text: %w", err)
	}
	return t, nil
}

// Insert implements service.Store.
func (p *Postgres) Insert(ctx context.Context, c domain.Consent, key string) (domain.Consent, bool, error) {
	evidence, err := json.Marshal(c.Evidence)
	if err != nil {
		return domain.Consent{}, false, err
	}
	var idemKey *string
	if key != "" {
		idemKey = &key
	}
	rows, err := p.db.Query(ctx, `INSERT INTO consents.consents
		(id, user_id, device_id, provider, scopes, purpose, term_days, status, text_version, evidence,
		 idempotency_key, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
		RETURNING `+consentColumns,
		c.ID, c.UserID, c.DeviceID, c.Provider, scopeStrings(c.Scopes), c.Purpose, c.TermDays, string(c.Status),
		c.TextVersion, evidence, idemKey, c.CreatedAt)
	if err != nil {
		return domain.Consent{}, false, fmt.Errorf("consents: insert: %w", err)
	}
	inserted, err := collect(rows)
	if err != nil {
		return domain.Consent{}, false, fmt.Errorf("consents: insert: %w", err)
	}
	if len(inserted) == 1 {
		return inserted[0], true, nil
	}
	existing, err := p.query(ctx, `SELECT `+consentColumns+` FROM consents.consents
		WHERE user_id = $1 AND idempotency_key = $2`, c.UserID, key)
	if err != nil || len(existing) != 1 {
		return domain.Consent{}, false, fmt.Errorf("consents: read idempotent consent: %w", err)
	}
	return existing[0], false, nil
}

// Get implements service.Store.
func (p *Postgres) Get(ctx context.Context, id string) (domain.Consent, error) {
	list, err := p.query(ctx, `SELECT `+consentColumns+` FROM consents.consents WHERE id = $1`, id)
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "22P02" { // not a uuid: it cannot exist
		return domain.Consent{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Consent{}, fmt.Errorf("consents: get: %w", err)
	}
	if len(list) == 0 {
		return domain.Consent{}, domain.ErrNotFound
	}
	return list[0], nil
}

// ListByUser implements service.Store.
func (p *Postgres) ListByUser(ctx context.Context, userID string) ([]domain.Consent, error) {
	list, err := p.query(ctx, `SELECT `+consentColumns+` FROM consents.consents
		WHERE user_id = $1 ORDER BY created_at DESC, id DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("consents: list: %w", err)
	}
	return list, nil
}

// Activate implements service.Store. The status check in the WHERE makes it safe against a
// concurrent grant or revocation.
func (p *Postgres) Activate(ctx context.Context, c domain.Consent) error {
	tag, err := p.db.Exec(ctx, `UPDATE consents.consents
		SET status = 'active', provider_consent_id = $2, granted_at = $3, expires_at = $4
		WHERE id = $1 AND status = 'pending'`, c.ID, c.ProviderConsentID, c.GrantedAt, c.ExpiresAt)
	if err != nil {
		return fmt.Errorf("consents: activate: %w", err)
	}
	if tag.RowsAffected() != 1 {
		return domain.ErrNotPending
	}
	return nil
}

// ExpireDue implements service.Store. Each row is returned by exactly one run, even when
// several API instances run the job at once.
func (p *Postgres) ExpireDue(ctx context.Context, now time.Time) ([]domain.Consent, error) {
	list, err := p.query(ctx, `UPDATE consents.consents SET status = 'expired'
		WHERE status = 'active' AND expires_at <= $1 RETURNING `+consentColumns, now)
	if err != nil {
		return nil, fmt.Errorf("consents: expire: %w", err)
	}
	return list, nil
}

func (p *Postgres) query(ctx context.Context, sql string, args ...any) ([]domain.Consent, error) {
	rows, err := p.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	return collect(rows)
}

func collect(rows pgx.Rows) ([]domain.Consent, error) {
	return pgx.CollectRows(rows, func(row pgx.CollectableRow) (domain.Consent, error) {
		var (
			c                 domain.Consent
			scopes            []string
			status            string
			evidence          []byte
			providerConsentID *string
			revokedReason     *string
		)
		err := row.Scan(&c.ID, &c.UserID, &c.DeviceID, &c.Provider, &scopes, &c.Purpose, &c.TermDays, &status,
			&c.TextVersion, &evidence, &providerConsentID, &c.CreatedAt, &c.GrantedAt, &c.ExpiresAt,
			&c.RevokedAt, &revokedReason)
		if err != nil {
			return domain.Consent{}, err
		}
		if err := json.Unmarshal(evidence, &c.Evidence); err != nil {
			return domain.Consent{}, err
		}
		for _, s := range scopes {
			c.Scopes = append(c.Scopes, domain.Scope(s))
		}
		c.Status = domain.Status(status)
		if providerConsentID != nil {
			c.ProviderConsentID = *providerConsentID
		}
		if revokedReason != nil {
			c.RevokedReason = *revokedReason
		}
		return c, nil
	})
}

func scopeStrings(scopes []domain.Scope) []string {
	out := make([]string, len(scopes))
	for i, s := range scopes {
		out[i] = string(s)
	}
	return out
}
