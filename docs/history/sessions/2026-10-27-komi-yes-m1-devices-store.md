---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/devices-store
tool: Claude Code
pr: none
status: done
---

# Store the linked devices in Postgres and give M2 its port

## Instruction

Same session as `feature/devices-service`. This part is the `identity.devices` table from `docs/modules/M01-identity.md` and "Expose `ActivateDevice(ctx, deviceID)` in `internal/identity/ports` for M2."

## What was done

* `internal/identity/migrations/1_create_devices.up.sql` (and `.down.sql`): the table from the M01 prompt plus three columns:
  * `session_id`, the Keycloak `sid`, revoked when the device is removed;
  * `idempotency_key`;
  * unique `(user_id, public_key)` and unique `(user_id, idempotency_key)`.
* The module's `Migrations()` now returns them.
* `internal/identity/postgres/repo.go`:
  * the pgx repository;
  * every write transaction first takes `pg_advisory_xact_lock` for the user and reads with `FOR UPDATE`;
  * a race on a unique key is retried once;
  * a malformed id is treated as "not found";
  * Postgres messages, which can echo values, are replaced by the operation name and the error code.
* `internal/identity/ports/ports.go`: `NewDevices(pool, clock).ActivateDevice(ctx, deviceID)` for M2. It doesn't audit; M2 records `device.approved`.
* `postgres/repo_integration_test.go` (tag `integration`, needs `DATABASE_URL`):
  * the first device is active and the second pending;
  * 10 parallel first registrations leave one active device;
  * idempotency;
  * another user gets "not found";
  * a removed device and a removed key are refused;
  * `RemoveOthers` and `ActivateDevice`.
* `Makefile` (M0): `test-integration` also runs `./internal/identity/postgres/...`.
* `cmd/migrate/main_test.go` (M0): the test assumed no module had migrations yet. It now expects identity to be the first schema that needs the database.

## Result

* `go vet` (with and without the `integration` tag), `go test ./...` and `make lint-go` are clean.
* `make test-integration` against a fresh Postgres 16.15 passed twice in a row. Claude Code ran these again after its own fixes.

## Decisions

* Ids are compared as `uuid`, not as text, so lookups use the primary key. Claude Code changed this in review.

## Problems

* The `cmd/migrate` test had to change, because it is an M0 file that assumed no module had SQL. Sofia is asked to review it.

## Next step

* `feature/devices-endpoints`: the contract and the HTTP handlers for `POST /devices`, `GET /devices`, `GET /devices/current`, `DELETE /devices/{id}` and `POST /devices/sign-out-others`.
