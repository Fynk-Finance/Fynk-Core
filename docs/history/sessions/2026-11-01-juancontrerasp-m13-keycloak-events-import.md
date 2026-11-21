---
date: 2026-11-01
developer: Juan Pablo Contreras
github: juancontrerasp
module: M13
jira: [SCRUM-41]
branch: feature/keycloak-events-import
tool: Claude Code
pr: none
status: done
---

# M13 Step 2: Periodic Keycloak authentication events import job

## Instruction

Continue with Module M13 (Compliance, privacy and audit), Phase 1: `feature/keycloak-events-import` (HU-027, SCRUM-41), implementing the periodic job that reads authentication events from Keycloak and records them into the append-only audit trail.

## What was done

* Keycloak Configuration & Permissions:
  * `services/keycloak/realms/fynk-realm.json`: Added `view-events` role to `service-account-fynk-admin` clientRoles in `realm-management`, granting the confidential admin client permission to read the realm's event log.
  * `services/keycloak/README.md`: Updated `fynk-admin` client documentation to note `view-events` permission used for M13 authentication audit imports.
  * `services/api/internal/identity/keycloak/realm_test.go`: Updated `TestAdminClientIsAConfidentialServiceAccount` to verify `manage-users`, `view-events`, and `view-users`.
* Keycloak Admin Client Event Querying:
  * `services/api/internal/identity/kcadmin/client.go`: Added `AuthEvent` struct, `EventsFilter`, and `GetEvents(ctx, filter) ([]AuthEvent, error)` to query `/admin/realms/{realm}/events`.
  * `services/api/internal/identity/kcadmin/client_test.go`: Added unit test `TestGetEvents` testing query parameter formatting, authorization headers, and response decoding.
* Identity Module Port:
  * `services/api/internal/identity/ports/ports.go`: Exported `AuthEvent`, `AuthEvents` interface, and constructor `NewAuthEvents(cfg config.Config) AuthEvents`.
  * `services/api/internal/identity/ports/ports_test.go`: Added `TestAuthEventsRetrievesAndFiltersEvents`.
* Audit Database Migrations:
  * `services/api/internal/audit/migrations/2_create_keycloak_import.up.sql`: Created `audit.keycloak_events_cursor` for tracking the last synchronization timestamp, and `audit.keycloak_processed_events` for exactly-once event deduplication.
  * `services/api/internal/audit/migrations/2_create_keycloak_import.down.sql`: Drops created tables on rollback.
* Keycloak Event Importer Job (`services/api/internal/audit/importer.go`):
  * Implemented `KeycloakImporter` taking `*pgxpool.Pool`, `ports.Recorder`, `identityports.AuthEvents`, `*slog.Logger`, and `clock.Clock`.
  * `ImportOnce`:
    * Locks cursor row via `SELECT ... FOR UPDATE` to serialize execution across multi-instance deployments.
    * Queries Keycloak events with a 5-minute safety buffer (`querySince = last_event_time - 5m`) to eliminate clock-skew and ingestion latency edge cases.
    * Filters for `LOGIN`, `LOGIN_ERROR`, `RESET_PASSWORD`, and `UPDATE_PASSWORD`.
    * Chronologically sorts events ascending before recording.
    * Deduplicates against `audit.keycloak_processed_events`.
    * Maps Keycloak events to `ports.AuthLogin`, `ports.AuthLoginFailed`, and `ports.AuthPasswordReset`.
    * Strictly purges sensitive fields: username, email addresses, and codes are never mapped to metadata. Only allow-listed attributes (`status`, `ip`, `auth_method`, `reason`, `error_code`) are persisted.
    * Records mapped events to the append-only cryptographic hash chain via `ports.Recorder`.
    * Prunes processed event records older than 7 days.
  * `Run`: Executes immediately and on a configurable ticker (`5 * time.Minute`), cleanly stopping when the context terminates.
* Wiring in Main API Server:
  * `services/api/cmd/api/main.go`: When `cfg.KeycloakAdminClientSecret` is configured, starts `KeycloakImporter.Run(ctx, 5*time.Minute)` in the background tied to the server shutdown context.
* Tests:
  * Unit tests (`importer_test.go`): Tests `mapKeycloakEvent` ensuring valid metadata, proper mapping of login, failure, and password reset events, and strict discarding of usernames/emails.
  * Integration tests (`store_integration_test.go`): Tests `KeycloakImporterIntegration` verifying end-to-end import, deduplication of already recorded events, cursor advancement, and valid audit hash chain integrity.

## Result

* `make lint-go` passed with 0 issues.
* `make test-go test-scripts` passed (all Go unit tests and scripts pass).
* `make format-check` passed.

## Decisions and problems

* Keycloak's `GET /events` API date filtering operates on `yyyy-MM-dd` granularity. The importer passes the day boundary and performs microsecond-level timestamp filtering and exact-ID deduplication in PostgreSQL to prevent duplicate audit chain entries.
* A 5-minute query lookback window ensures no events are lost due to clock skew between container instances, while the `keycloak_processed_events` table ensures strict idempotency.

## Next step

Step 3: `feature/privacy-policy-and-my-data` (Phase 4, implementing `GET /privacy/policy` and `GET /privacy/my-data`).
