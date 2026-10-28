---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/devices-service
tool: Claude Code
pr: none
status: done
---

# The rules for a user's linked devices (no database or HTTP yet)

## Instruction

The developer approved the plan to finish M1 and said "continue". Claude Code plans and reviews, and a Sonnet subagent writes each task ("with sonnet 5.5 do the implementation following the plan you design and verify that the work done is correct"). This part is the device rules of `docs/modules/M01-identity.md`: "The first device of a user becomes `active` at registration. Any later device stays `pending` until M2 approves it or the recovery code is used."

## What was done

* `internal/identity/devices/device.go`:
  * the `Device`, `Status` and `Platform` types;
  * validation: a name of 1 to 64 characters with no control characters, `ios` or `android`, and a public key of exactly 32 bytes;
  * errors that never carry the name or the key, and a `String` that hides both.
* `internal/identity/devices/service.go`:
  * **Register** runs in one transaction under a per-user lock. The same Idempotency-Key or the same public key returns the existing device. A removed key is refused, so the phone makes a new key pair. The device is `active` when the user has no active device, otherwise `pending`. It audits `device.registered`, with only the platform and status.
  * **List**, **Current** (also updates the last-seen time and the Keycloak session id), **Remove**, **RemoveOthers** (for "Cerrar todas las demás sesiones"), **Usable** (the token verifier's device check) and **Activate** (for M2).
* `devices/service_test.go`: every rule on a fake repository with a fixed clock.
* `go.mod`: `google/uuid`, `golang-jwt` and `testcontainers-go` are marked as direct dependencies (`go mod tidy`). No new library.

## Result

* `go vet`, `go test ./...` and `make lint-go` are clean.

## Decisions

* The device name never goes into audit events or logs, because a name like "iPhone de Laura" is personal.
* After every active device is removed, a new device becomes active again. The vault key never reaches the server, so an active device without M2's approval still can't read any data.

## Problems

* The subagent wrote its own UUID generator to avoid editing `go.mod`. Claude Code replaced it with `google/uuid`, which was already a dependency.
* A Claude Code edit made with Python wrote Windows line endings, which gofmt flagged. They were changed back to LF.

## Next step

* `feature/devices-store`: the `identity.devices` table, the Postgres repository and the M2 port, stacked on this branch.
