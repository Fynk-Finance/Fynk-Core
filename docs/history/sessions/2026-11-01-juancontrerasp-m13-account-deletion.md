---
date: 2026-11-01
developer: Juan Pablo Contreras
github: juancontrerasp
module: M13
jira: [SCRUM-42]
branch: feature/account-deletion
tool: Antigravity
pr: none
status: done
---

# Cascade account deletion under Ley 1581 de 2012 (SCRUM-42)

## Instruction

Implement the cascade account deletion endpoints for Module M13 per `docs/modules/M13-compliance.md` and Jira SCRUM-42 (HU-028):
1. `POST /privacy/deletion-requests`: requires authentication and fresh login in the last 5 minutes (`user.SessionID` verified via `identity.Sessions`). Executes cascade deletion in legal sequence:
   * Step 1: Revoke every consent through M4 (notifies bank provider).
   * Step 2: Mark every bank link revoked and delete bank link records.
   * Step 3: Delete backup records, recovery key, and device approvals.
   * Step 4: Delete registered devices.
   * Step 5: Delete Keycloak user via Keycloak admin API.
   * Step 6: Retain only deletion evidence (`privacy.deletion_requests`: request id, user id hash, timestamps, steps done) and immutable audit records.
2. `GET /privacy/deletion-requests/{id}`: public endpoint returning completion status and legal confirmation message: `"Tu cuenta y tus datos fueron eliminados el <fecha>."`.
3. Unit and integration tests verifying zero rows remain for the deleted user across `identity`, `backup`, `bank`, and only revoked evidence in `consents`.

## What was done

* **OpenAPI Contract (`contracts/modules/privacy.yaml`):**
  * Added `POST /privacy/deletion-requests` with optional `PrivacyDeletionRequestCreate` body (typed confirmation `ELIMINAR` and optional reason).
  * Added `GET /privacy/deletion-requests/{id}` with `security: []` (public) returning `PrivacyDeletionRequest`.
  * Updated schemas: `PrivacyDeletionRequest` (`id`, `status`, `createdAt`, `completedAt`, `stepsDone`, `message`) and `PrivacyDeletionRequestCreate`.
  * Ran `make generate` to update Go server interface and mobile TypeScript definitions.
* **Database Migration (`services/api/internal/privacy/migrations/`):**
  * Created `1_create_deletion_requests.up.sql` creating `privacy.deletion_requests` with `user_id_hash bytea NOT NULL CHECK (octet_length(user_id_hash) = 32)` and index on `user_id_hash`.
  * Created `1_create_deletion_requests.down.sql` dropping table and index.
  * Embedded migration files via `migrations.FS`.
* **Module Ports (`identity/ports` and `consents/ports`):**
  * `identity/ports`: added `UserDeleter` interface and `NewUserDeleter(cfg)` delegating to `kcadmin.Client.DeleteUser`.
  * `consents/ports`: added `ConsentsRevoker` interface and `NewConsentsRevoker(deps)` to safely revoke active and pending user consents with bank notification across module boundaries.
* **Privacy Module Implementation (`services/api/internal/privacy/`):**
  * `deleter.go`: implemented `Deleter` with `DeleteAccount` and `GetRequest`:
    * Fresh session verification against `identity.Sessions` within 5 minutes (returning `fresh_login_required` 403 on stale or missing session).
    * Confirmation validation (returning `invalid_confirmation` 400 if confirmation keyword mismatch).
    * Cascade deletion across consents, bank links, backup records, recovery keys, device approvals, identity devices, and Keycloak user.
    * Record audit events: `privacy.deletion_requested` and `privacy.deletion_completed`.
    * Record deletion evidence in `privacy.deletion_requests` storing only `sha256(user_id)` to preserve Zero-Knowledge privacy.
    * Formatted legal completion message in Spanish (`DeletionMessage`).
  * `server.go`: implemented `CreateDeletionRequest` (returning 202 Accepted) and `GetDeletionRequest` (returning 200 OK or 404).
  * `module.go`: wired `deleter`, returned `migrations.FS` in `Migrations()`, and allowed public access to `GET /privacy/deletion-requests/{id}` without authentication token.
* **Tests:**
  * Updated `services/api/internal/privacy/privacy_test.go` with unit tests for `POST /v1/privacy/deletion-requests` (unauthenticated, bad confirmation, success 202), public `GET /v1/privacy/deletion-requests/{id}` (404/200 without token), and fresh login verification (stale vs fresh session).
  * Added `deleter_integration_test.go` testing against PostgreSQL and asserting zero rows remain in `identity.devices`, `bank.links`, `backup.records`, `backup.recovery_keys`, and `backup.device_approvals`, while retaining revoked evidence in `consents.consents` and hashed evidence in `privacy.deletion_requests`.
  * Updated `services/api/internal/app/app_test.go` stub path list.

## Result

* `make lint-go`: clean (0 issues).
* `make test-go test-scripts`: clean (100% passed).
* `make format-check`: clean.

## Decisions and problems

* **Public status lookup after account deletion:** After an account is deleted, the user's Keycloak account and sessions are destroyed, meaning they cannot provide an Authorization token. Marked `GET /privacy/deletion-requests/{id}` with `security: []` in the OpenAPI specification and exempt in `requireAuth` middleware so users can check confirmation after account deletion.
* **Zero-Knowledge deletion evidence:** To comply with Colombian data protection regulations (Ley 1581) while respecting the Zero-Knowledge architecture, the deletion evidence table `privacy.deletion_requests` never stores cleartext `user_id`. Instead, it stores `sha256(user_id)` as 32-byte hash (`user_id_hash bytea NOT NULL CHECK (octet_length(user_id_hash) = 32)`).
* **Consents retention vs deletion:** Consents table rows are not deleted; they are marked `revoked` with timestamp and reason per legal requirement to prove compliance and consent lifecycle to authorities (Superintendencia de Industria y Comercio). All other user personal and financial records (`identity`, `bank`, `backup`) are deleted with zero remaining rows.
