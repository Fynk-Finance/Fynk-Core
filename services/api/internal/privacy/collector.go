package privacy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	openapi_types "github.com/oapi-codegen/runtime/types"

	identity "github.com/Fynk-Finance/Fynk-Core/services/api/internal/identity/ports"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
)

// ProfileReader abstracts reading a user profile from Keycloak.
type ProfileReader interface {
	GetUser(ctx context.Context, userID string) (identity.UserProfile, error)
}

// Collector collects all personal and account data stored in the cloud for a given user.
type Collector struct {
	pool    *pgxpool.Pool
	profile ProfileReader
	clock   clock.Clock
}

// NewCollector creates a Collector.
func NewCollector(pool *pgxpool.Pool, profile ProfileReader, clk clock.Clock) *Collector {
	if clk == nil {
		clk = clock.System{}
	}
	return &Collector{
		pool:    pool,
		profile: profile,
		clock:   clk,
	}
}

// Export compiles all user data stored in the cloud.
func (c *Collector) Export(ctx context.Context, userID string) (httpapi.PrivacyDataExport, error) {
	now := c.clock.Now().UTC()
	export := httpapi.PrivacyDataExport{
		ExportedAt:  now,
		Devices:     make([]httpapi.PrivacyDeviceData, 0),
		Consents:    make([]httpapi.PrivacyConsentData, 0),
		BankLinks:   make([]httpapi.PrivacyBankLinkData, 0),
		AuditEvents: make([]httpapi.PrivacyAuditEventData, 0),
	}

	// 1. Profile from Keycloak
	export.Profile = c.fetchProfile(ctx, userID, now)

	if c.pool == nil {
		return export, nil
	}

	// 2. Devices from identity.devices
	devices, err := c.fetchDevices(ctx, userID)
	if err != nil {
		return export, fmt.Errorf("privacy: fetch devices: %w", err)
	}
	export.Devices = devices

	// 3. Consents from consents.consents
	consents, err := c.fetchConsents(ctx, userID)
	if err != nil {
		return export, fmt.Errorf("privacy: fetch consents: %w", err)
	}
	export.Consents = consents

	// 4. Bank links from bank.links (strictly without token fingerprints)
	links, err := c.fetchBankLinks(ctx, userID)
	if err != nil {
		return export, fmt.Errorf("privacy: fetch bank links: %w", err)
	}
	export.BankLinks = links

	// 5. Backup summary from backup.records and backup.recovery_keys
	backup, err := c.fetchBackup(ctx, userID)
	if err != nil {
		return export, fmt.Errorf("privacy: fetch backup: %w", err)
	}
	export.Backup = backup

	// 6. Audit events from audit.events
	events, err := c.fetchAuditEvents(ctx, userID)
	if err != nil {
		return export, fmt.Errorf("privacy: fetch audit events: %w", err)
	}
	export.AuditEvents = events

	return export, nil
}

func (c *Collector) fetchProfile(ctx context.Context, userID string, fallbackTime time.Time) httpapi.PrivacyProfileData {
	prof := httpapi.PrivacyProfileData{
		Id:            userID,
		Email:         openapi_types.Email(userID + "@fynk.local"),
		EmailVerified: false,
		CreatedAt:     fallbackTime,
	}

	if c.profile == nil {
		return prof
	}

	u, err := c.profile.GetUser(ctx, userID)
	if err != nil {
		if errors.Is(err, identity.ErrNotFound) || errors.Is(err, identity.ErrUnavailable) {
			return prof
		}
		return prof
	}

	if u.Email != "" {
		prof.Email = openapi_types.Email(u.Email)
	}
	prof.EmailVerified = u.EmailVerified
	if !u.CreatedAt.IsZero() {
		prof.CreatedAt = u.CreatedAt
	}
	if u.FirstName != "" {
		prof.FirstName = &u.FirstName
	}
	if u.LastName != "" {
		prof.LastName = &u.LastName
	}
	return prof
}

func (c *Collector) fetchDevices(ctx context.Context, userID string) ([]httpapi.PrivacyDeviceData, error) {
	const query = `
		SELECT id, name, platform, encode(public_key, 'hex'), status, created_at, last_seen_at
		FROM identity.devices
		WHERE user_id = $1
		ORDER BY created_at ASC
	`
	rows, err := c.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make([]httpapi.PrivacyDeviceData, 0)
	for rows.Next() {
		var idStr, name, platStr, pkHex, statusStr string
		var createdAt, lastSeenAt time.Time
		if err := rows.Scan(&idStr, &name, &platStr, &pkHex, &statusStr, &createdAt, &lastSeenAt); err != nil {
			return nil, err
		}
		uid, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}
		dev := httpapi.PrivacyDeviceData{
			Id:         uid,
			Name:       name,
			Platform:   httpapi.PrivacyDeviceDataPlatform(platStr),
			Status:     httpapi.PrivacyDeviceDataStatus(statusStr),
			CreatedAt:  createdAt,
			LastSeenAt: lastSeenAt,
		}
		if pkHex != "" {
			dev.PublicKeyHex = &pkHex
		}
		res = append(res, dev)
	}
	return res, rows.Err()
}

func (c *Collector) fetchConsents(ctx context.Context, userID string) ([]httpapi.PrivacyConsentData, error) {
	const query = `
		SELECT id, provider, scopes, purpose, term_days, status, text_version, evidence,
		       created_at, granted_at, expires_at, revoked_at, revoked_reason
		FROM consents.consents
		WHERE user_id = $1
		ORDER BY created_at ASC
	`
	rows, err := c.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make([]httpapi.PrivacyConsentData, 0)
	for rows.Next() {
		var idStr, provider, purpose, status, textVersion string
		var scopes []string
		var termDays int
		var evidenceBytes []byte
		var createdAt time.Time
		var grantedAt, expiresAt, revokedAt *time.Time
		var revokedReason *string

		if err := rows.Scan(&idStr, &provider, &scopes, &purpose, &termDays, &status, &textVersion,
			&evidenceBytes, &createdAt, &grantedAt, &expiresAt, &revokedAt, &revokedReason); err != nil {
			return nil, err
		}
		uid, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}

		evidence := make(map[string]interface{})
		if len(evidenceBytes) > 0 {
			_ = json.Unmarshal(evidenceBytes, &evidence)
		}

		res = append(res, httpapi.PrivacyConsentData{
			Id:            uid,
			Provider:      provider,
			Scopes:        scopes,
			Purpose:       purpose,
			TermDays:      termDays,
			Status:        status,
			TextVersion:   textVersion,
			Evidence:      evidence,
			CreatedAt:     createdAt,
			GrantedAt:     grantedAt,
			ExpiresAt:     expiresAt,
			RevokedAt:     revokedAt,
			RevokedReason: revokedReason,
		})
	}
	return res, rows.Err()
}

func (c *Collector) fetchBankLinks(ctx context.Context, userID string) ([]httpapi.PrivacyBankLinkData, error) {
	// Strictly omit token_fingerprint from the select to prevent any sensitive credential emission.
	const query = `
		SELECT id, provider, consent_id, status, created_at, last_refreshed_at, revoked_at
		FROM bank.links
		WHERE user_id = $1
		ORDER BY created_at ASC
	`
	rows, err := c.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make([]httpapi.PrivacyBankLinkData, 0)
	for rows.Next() {
		var idStr, provider, consentIDStr, statusStr string
		var createdAt time.Time
		var lastRefreshedAt, revokedAt *time.Time

		if err := rows.Scan(&idStr, &provider, &consentIDStr, &statusStr, &createdAt, &lastRefreshedAt, &revokedAt); err != nil {
			return nil, err
		}
		uid, err := uuid.Parse(idStr)
		if err != nil {
			continue
		}
		cid, err := uuid.Parse(consentIDStr)
		if err != nil {
			continue
		}

		res = append(res, httpapi.PrivacyBankLinkData{
			Id:              uid,
			Provider:        provider,
			ConsentId:       cid,
			Status:          httpapi.PrivacyBankLinkDataStatus(statusStr),
			CreatedAt:       createdAt,
			LastRefreshedAt: lastRefreshedAt,
			RevokedAt:       revokedAt,
		})
	}
	return res, rows.Err()
}

func (c *Collector) fetchBackup(ctx context.Context, userID string) (httpapi.PrivacyBackupData, error) {
	var backup httpapi.PrivacyBackupData

	const recQuery = `
		SELECT count(*), coalesce(sum(octet_length(ciphertext)), 0), max(updated_at)
		FROM backup.records
		WHERE user_id = $1 AND NOT deleted
	`
	var maxUpdated *time.Time
	if err := c.pool.QueryRow(ctx, recQuery, userID).Scan(&backup.RecordCount, &backup.TotalSizeBytes, &maxUpdated); err != nil {
		return backup, err
	}
	backup.LastBackupAt = maxUpdated

	const keyQuery = `
		SELECT EXISTS (
			SELECT 1 FROM backup.recovery_keys WHERE user_id = $1
		)
	`
	if err := c.pool.QueryRow(ctx, keyQuery, userID).Scan(&backup.HasRecoveryKey); err != nil {
		return backup, err
	}

	return backup, nil
}

func (c *Collector) fetchAuditEvents(ctx context.Context, userID string) ([]httpapi.PrivacyAuditEventData, error) {
	const query = `
		SELECT id, type, device_id, at, meta
		FROM audit.events
		WHERE user_id = $1
		ORDER BY id ASC
	`
	rows, err := c.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	res := make([]httpapi.PrivacyAuditEventData, 0)
	for rows.Next() {
		var id int64
		var eventType string
		var devIDStr *string
		var at time.Time
		var metaBytes []byte

		if err := rows.Scan(&id, &eventType, &devIDStr, &at, &metaBytes); err != nil {
			return nil, err
		}

		var devUUID *uuid.UUID
		if devIDStr != nil && *devIDStr != "" {
			parsed, err := uuid.Parse(*devIDStr)
			if err == nil {
				devUUID = &parsed
			}
		}

		meta := make(map[string]interface{})
		if len(metaBytes) > 0 {
			_ = json.Unmarshal(metaBytes, &meta)
		}

		res = append(res, httpapi.PrivacyAuditEventData{
			Id:       id,
			Type:     eventType,
			DeviceId: devUUID,
			At:       at,
			Meta:     meta,
		})
	}
	return res, rows.Err()
}
