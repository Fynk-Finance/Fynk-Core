---
date: 2026-10-28
developer: Juan Pablo Contreras
github: juancontrerasp
module: M13
jira: [SCRUM-41]
branch: feature/audit-store-append-only
tool: Claude Code
pr: none
status: done
---

# M13 Step 1: Append-only hash-chained audit store and verification

## Instruction

Continue with the last assigned module (M13 Compliance, privacy and audit), starting with Phase 1: `feature/audit-store-append-only` (HU-027, SCRUM-41).

## What was done

* Database Migrations (`services/api/internal/audit/migrations/`):
  * `1_create_events.up.sql`: Created `events` table in schema `audit` with fields `id`, `type`, `user_id`, `device_id`, `at`, `meta`, `prev_hash`, `hash`, and indexes on `user_id` and `at`.
  * Implemented `prevent_event_modification()` trigger function and triggers `trg_prevent_event_modification` (BEFORE UPDATE OR DELETE) and `trg_prevent_event_truncate` (BEFORE TRUNCATE) enforcing database immutability.
  * Embedded migration files into `migrations.FS`.
* Sensitive Data Rejecter & Allow-list Validation (`services/api/internal/audit/validation.go`):
  * Strictly validated `ports.Event` against recognized event types (`ports.AuthLogin` through `ports.PrivacyDeletionCompleted`).
  * Enforced sensitive key detection rejecting forbidden terms (`amount`, `email`, `token`, `account_number`, `password`, `cedula`, `authorization`, `card`, `pan`, `cvv`, `jwt`, `secret`).
  * Validated `device_id` as valid UUID (when present) and metadata keys against type-specific allow-lists.
* Canonical Serialization & Hash Chaining (`services/api/internal/audit/canonical.go`):
  * Constructed deterministic canonical JSON encoding `CanonicalRow` with sorted map keys and microsecond-precision UTC timestamps (`2006-01-02T15:04:05.000000Z`).
  * Computed SHA-256 hash chaining: `hash = sha256(prev_hash || canonical_json_of_row)` with a 32-byte zero slice for genesis row.
* PostgreSQL Audit Store (`services/api/internal/audit/store.go`):
  * Implemented `Store` implementing `ports.Recorder`.
  * `Record`: acquires PostgreSQL transaction advisory lock (`pg_advisory_xact_lock`) to serialize append operations, fetches latest row hash as `prev_hash`, computes canonical hash, and inserts row.
  * `Verify`: scans rows ordered by `id ASC`, checks chain continuity (`prev_hash == previous_row.hash`), reconstructs canonical representation, and recalculates SHA-256 hashes to detect tampering or row removal.
* Verification Endpoint & CLI Command:
  * Added `GET /internal/audit/verify` handler in `services/api/internal/audit/http.go` and mounted on `app.NewRouter` with `auth.Require` and `app.WithAuditVerifier`.
  * Added CLI command `fynk-api audit verify` in `services/api/cmd/api/main.go`.
* Architectural Decision Record (`docs/adr/0004-audit-retention.md`):
  * Documented retention period proposal: 5 years for consent and privacy events (under Ley 1581 and statutory limitations for commercial claims) and 1 year for high-volume operational events.
* Tests:
  * Unit tests (`validation_test.go`, `canonical_test.go`, `http_test.go`, `app_test.go`).
  * Integration tests (`store_integration_test.go`) validating that `UPDATE`, `DELETE`, and `TRUNCATE` fail due to trigger, and verifying tamper/deletion detection.

## Result

* `make lint-go` passed with 0 issues.
* `make format-check` passed.
* `make test-go test-scripts` passed.

## Decisions and problems

* Advisory transaction lock `pg_advisory_xact_lock(8472918471928471)` guarantees a strictly linear hash chain across concurrent API instances without table-level deadlocks.
* Truncating timestamps to microsecond precision before computing hashes avoids floating point/nanosecond discrepancies when reading back from PostgreSQL `timestamptz`.

## Next step

Step 2: `feature/keycloak-events-import` (Phase 1, importing Keycloak user events into the audit trail every 5 minutes).
