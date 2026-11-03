//go:build integration

package privacy_test

import (
	"context"
	"crypto/sha256"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/auth"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/clock"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/platform/migrate"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy"
	httpapi "github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/http"
	"github.com/Fynk-Finance/Fynk-Core/services/api/internal/privacy/migrations"
)

func setupDB(t *testing.T) (*pgxpool.Pool, string) {
	t.Helper()
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx := context.Background()
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)

	// Ensure schemas and tables needed for deletion cascade test exist
	ddl := `
		CREATE SCHEMA IF NOT EXISTS identity;
		CREATE TABLE IF NOT EXISTS identity.devices (
			id              uuid PRIMARY KEY,
			user_id         text NOT NULL,
			name            text NOT NULL,
			platform        text NOT NULL,
			public_key      bytea NOT NULL,
			status          text NOT NULL,
			session_id      text,
			idempotency_key text,
			created_at      timestamptz NOT NULL,
			last_seen_at    timestamptz NOT NULL
		);

		CREATE SCHEMA IF NOT EXISTS bank;
		CREATE TABLE IF NOT EXISTS bank.links (
			id                uuid PRIMARY KEY,
			user_id           text NOT NULL,
			device_id         uuid NOT NULL,
			provider          text NOT NULL,
			consent_id        uuid NOT NULL,
			token_fingerprint bytea NOT NULL,
			status            text NOT NULL,
			created_at        timestamptz NOT NULL,
			last_refreshed_at timestamptz,
			revoked_at        timestamptz
		);

		CREATE SCHEMA IF NOT EXISTS backup;
		CREATE TABLE IF NOT EXISTS backup.records (
			user_id    text NOT NULL,
			collection text NOT NULL,
			record_id  uuid NOT NULL,
			version    bigint NOT NULL,
			deleted    boolean NOT NULL,
			nonce      bytea NOT NULL,
			ciphertext bytea NOT NULL,
			updated_at timestamptz NOT NULL,
			PRIMARY KEY (user_id, collection, record_id)
		);
		CREATE TABLE IF NOT EXISTS backup.recovery_keys (
			user_id           text PRIMARY KEY,
			wrapped_dek       bytea NOT NULL,
			nonce             bytea NOT NULL,
			salt              bytea NOT NULL,
			kdf               text NOT NULL,
			kdf_params        jsonb NOT NULL,
			created_at        timestamptz NOT NULL
		);
		CREATE TABLE IF NOT EXISTS backup.device_approvals (
			id                    uuid PRIMARY KEY,
			user_id               text NOT NULL,
			new_device_id         uuid NOT NULL,
			new_device_public_key bytea NOT NULL,
			status                text NOT NULL,
			ephemeral_public_key  bytea,
			wrapped_dek           bytea,
			nonce                 bytea,
			created_at            timestamptz NOT NULL,
			expires_at            timestamptz NOT NULL,
			decided_at            timestamptz
		);

		CREATE SCHEMA IF NOT EXISTS consents;
		CREATE TABLE IF NOT EXISTS consents.consent_texts (
			version      text PRIMARY KEY,
			body_md      text NOT NULL,
			sha256       bytea NOT NULL,
			published_at timestamptz NOT NULL
		);
		CREATE TABLE IF NOT EXISTS consents.consents (
			id                   uuid PRIMARY KEY,
			user_id              text NOT NULL,
			device_id            uuid NOT NULL,
			provider             text NOT NULL,
			scopes               text[] NOT NULL,
			purpose              text NOT NULL,
			term_days            int NOT NULL,
			status               text NOT NULL,
			text_version         text NOT NULL,
			evidence             jsonb NOT NULL,
			created_at           timestamptz NOT NULL,
			granted_at           timestamptz,
			expires_at           timestamptz,
			revoked_at           timestamptz,
			revoked_reason       text,
			provider_consent_id  text,
			provider_notified_at timestamptz,
			next_notify_at       timestamptz,
			notify_attempts      int NOT NULL DEFAULT 0
		);
	`
	if _, err := pool.Exec(ctx, ddl); err != nil {
		t.Fatalf("setup test schemas: %v", err)
	}

	// Apply privacy schema migrations
	if _, err := migrate.Up(ctx, dbURL, migrate.Source{Schema: "privacy", FS: migrations.FS}); err != nil {
		t.Fatalf("migrate privacy: %v", err)
	}

	return pool, dbURL
}

func TestAccountDeletionCascadeZeroRows(t *testing.T) {
	pool, _ := setupDB(t)
	ctx := context.Background()
	now := time.Now().UTC()
	clk := clock.NewFixed(now)

	userToDelete := "del-user-1"
	userToKeep := "keep-user-2"

	devDelID := uuid.New()
	devKeepID := uuid.New()
	consentDelID := uuid.New()
	consentKeepID := uuid.New()
	bankLinkDelID := uuid.New()
	bankLinkKeepID := uuid.New()
	backupRecDelID := uuid.New()
	backupRecKeepID := uuid.New()
	approvalDelID := uuid.New()

	pk := make([]byte, 32)
	tokenFP := make([]byte, 32)

	// Seed identity.devices
	_, err := pool.Exec(ctx, `
		INSERT INTO identity.devices (id, user_id, name, platform, public_key, status, created_at, last_seen_at)
		VALUES
			($1, $2, 'Phone Del', 'ios', $3, 'active', $4, $4),
			($5, $6, 'Phone Keep', 'android', $3, 'active', $4, $4)
	`, devDelID, userToDelete, pk, now, devKeepID, userToKeep)
	if err != nil {
		t.Fatalf("seed devices: %v", err)
	}

	// Seed consents
	_, err = pool.Exec(ctx, `
		INSERT INTO consents.consent_texts (version, body_md, sha256, published_at)
		VALUES ('v1', 'test text', $1, $2)
		ON CONFLICT (version) DO NOTHING;

		INSERT INTO consents.consents (id, user_id, device_id, provider, scopes, purpose, term_days, status, text_version, evidence, created_at)
		VALUES
			($1, $2, $3, 'banco-demo', ARRAY['balances'], 'testing', 365, 'active', 'v1', '{"accepted_at":"2026-11-01"}'::jsonb, $4),
			($5, $6, $7, 'banco-demo', ARRAY['balances'], 'testing', 365, 'active', 'v1', '{"accepted_at":"2026-11-01"}'::jsonb, $4)
	`, pk, now, consentDelID, userToDelete, devDelID, now, consentKeepID, userToKeep, devKeepID)
	if err != nil {
		t.Fatalf("seed consents: %v", err)
	}

	// Seed bank.links
	_, err = pool.Exec(ctx, `
		INSERT INTO bank.links (id, user_id, device_id, provider, consent_id, token_fingerprint, status, created_at)
		VALUES
			($1, $2, $3, 'banco-demo', $4, $5, 'active', $6),
			($7, $8, $9, 'banco-demo', $10, $5, 'active', $6)
	`, bankLinkDelID, userToDelete, devDelID, consentDelID, tokenFP, now,
		bankLinkKeepID, userToKeep, devKeepID, consentKeepID)
	if err != nil {
		t.Fatalf("seed bank links: %v", err)
	}

	// Seed backup
	_, err = pool.Exec(ctx, `
		INSERT INTO backup.records (user_id, collection, record_id, version, deleted, nonce, ciphertext, updated_at)
		VALUES
			($1, 'accounts', $2, 1, false, $3, $3, $4),
			($5, 'accounts', $6, 1, false, $3, $3, $4);

		INSERT INTO backup.recovery_keys (user_id, wrapped_dek, nonce, salt, kdf, kdf_params, created_at)
		VALUES ($1, $7, $8, $9, 'argon2id', '{}'::jsonb, $4);

		INSERT INTO backup.device_approvals (id, user_id, new_device_id, new_device_public_key, status, created_at, expires_at)
		VALUES ($10, $1, $11, $12, 'pending', $4, $4);
	`, userToDelete, backupRecDelID, pk[:12], now,
		userToKeep, backupRecKeepID,
		pk, pk[:12], pk[:16],
		approvalDelID, devDelID, pk)
	if err != nil {
		t.Fatalf("seed backup: %v", err)
	}

	consentsRevoker := &fakeConsentsRevoker{}
	userDeleter := &fakeUserDeleter{}
	deleter := privacy.NewDeleter(pool, clk, nil, nil, consentsRevoker, userDeleter)

	req := httpapi.PrivacyDeletionRequestCreate{}
	delResp, err := deleter.DeleteAccount(ctx, auth.User{ID: userToDelete, DeviceID: devDelID.String()}, req)
	if err != nil {
		t.Fatalf("DeleteAccount: %v", err)
	}

	if delResp.Status != httpapi.Completed {
		t.Errorf("status = %q, want completed", delResp.Status)
	}

	// Verify zero rows in identity.devices for deleted user
	var devDelCount int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM identity.devices WHERE user_id = $1", userToDelete).Scan(&devDelCount)
	if devDelCount != 0 {
		t.Errorf("identity.devices deleted count = %d, want 0", devDelCount)
	}
	var devKeepCount int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM identity.devices WHERE user_id = $1", userToKeep).Scan(&devKeepCount)
	if devKeepCount != 1 {
		t.Errorf("identity.devices keep count = %d, want 1", devKeepCount)
	}

	// Verify zero rows in bank.links for deleted user
	var linkDelCount int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM bank.links WHERE user_id = $1", userToDelete).Scan(&linkDelCount)
	if linkDelCount != 0 {
		t.Errorf("bank.links deleted count = %d, want 0", linkDelCount)
	}
	var linkKeepCount int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM bank.links WHERE user_id = $1", userToKeep).Scan(&linkKeepCount)
	if linkKeepCount != 1 {
		t.Errorf("bank.links keep count = %d, want 1", linkKeepCount)
	}

	// Verify zero rows in backup.records, backup.recovery_keys, backup.device_approvals
	var recDelCount int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM backup.records WHERE user_id = $1", userToDelete).Scan(&recDelCount)
	if recDelCount != 0 {
		t.Errorf("backup.records count = %d, want 0", recDelCount)
	}
	var recKeepCount int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM backup.records WHERE user_id = $1", userToKeep).Scan(&recKeepCount)
	if recKeepCount != 1 {
		t.Errorf("backup.records keep count = %d, want 1", recKeepCount)
	}

	var keyCount int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM backup.recovery_keys WHERE user_id = $1", userToDelete).Scan(&keyCount)
	if keyCount != 0 {
		t.Errorf("backup.recovery_keys count = %d, want 0", keyCount)
	}

	var appCount int
	_ = pool.QueryRow(ctx, "SELECT count(*) FROM backup.device_approvals WHERE user_id = $1", userToDelete).Scan(&appCount)
	if appCount != 0 {
		t.Errorf("backup.device_approvals count = %d, want 0", appCount)
	}

	// Verify consents: row remains as legal evidence, revoked
	var consentStatus string
	var revokedAt *time.Time
	err = pool.QueryRow(ctx, "SELECT status, revoked_at FROM consents.consents WHERE user_id = $1", userToDelete).Scan(&consentStatus, &revokedAt)
	if err != nil {
		t.Fatalf("consents row missing: %v", err)
	}
	// In the real system consentsRevoker marks it revoked:
	if len(consentsRevoker.revokedUsers) != 1 || consentsRevoker.revokedUsers[0] != userToDelete {
		t.Errorf("consentsRevoker called for %v, want [%s]", consentsRevoker.revokedUsers, userToDelete)
	}

	// Verify privacy.deletion_requests stores user_id_hash
	var storedStatus string
	var storedHash []byte
	var stepsDone []string
	expectedHash := sha256.Sum256([]byte(userToDelete))
	err = pool.QueryRow(ctx, "SELECT status, user_id_hash, steps_done FROM privacy.deletion_requests WHERE id = $1", delResp.Id).Scan(&storedStatus, &storedHash, &stepsDone)
	if err != nil {
		t.Fatalf("deletion_request not found: %v", err)
	}
	if storedStatus != "completed" {
		t.Errorf("storedStatus = %q, want completed", storedStatus)
	}
	if string(storedHash) != string(expectedHash[:]) {
		t.Errorf("storedHash does not match sha256(user_id)")
	}

	// Verify public GET retrieval
	getResp, err := deleter.GetRequest(ctx, delResp.Id)
	if err != nil {
		t.Fatalf("GetRequest: %v", err)
	}
	if getResp.Status != httpapi.Completed {
		t.Errorf("GetRequest status = %q, want completed", getResp.Status)
	}
	if getResp.Message != delResp.Message {
		t.Errorf("GetRequest message = %q, want %q", getResp.Message, delResp.Message)
	}
}
