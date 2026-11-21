---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-20]
branch: feature/consents-fail-stale-pending
tool: Claude Code
pr: none
status: done
---

# Fail consents still pending after 24 hours

## Instruction

Juan Carlos decided what happens to consents nobody finished: "If a consent is still pendant after 24 hours, that should be marked as failed, for sure or even less, beacuse in anyway, the own person can ask for another consent".

## What was done

* `consents/domain`: `PendingFor = 24 * time.Hour`. `StatusAt` reports a pending consent as `failed` once it passes, so `Get`, `List`, `Active`, `Grant` and `Revoke` treat it as ended even before the job runs.
* `consents/store`: `FailPending(createdBy)` in Postgres and in memory, which marks those rows `failed` and returns each one once.
* `consents/service`: `FailStalePending`, run by the existing daily job (`RunExpiry`) after `ExpireDue`.
* Tests: a domain test (pending until the last second, then failed; it can no longer be granted or revoked), 2 service tests (only the old pending one fails, once; reads show it failed before the job; the job runs it), and a Postgres test of `FailPending`.

## Result

* Tests: `go test ./internal/consents/... ./internal/bank/... ./internal/privacy/...` passes; the consents integration tests pass against Postgres 16; golangci-lint: 0 issues.
* Pull request: not opened yet.

## Decisions and problems

* 24 hours, not less. Conectar banco keeps one idempotency key per entity while the screen is open, so "Intentar de nuevo" reuses the same pending consent. With a short limit, a person who left the screen open and retried later would get a consent that had already failed, and the retry would keep failing until they left the screen. The bank authorization itself lasts only 10 minutes, so 24 hours is never too short.
* M5's `POST /bank/authorizations` already refuses a consent that is not pending, so a failed one can't start an authorization.
* No audit event for this change yet: M13's audit list has no `consent.failed` type, and adding it means changing `internal/audit` (Juan Pablo's module). Asked Juan Carlos whether to propose it.
* The phone already shows `failed` as "Fallido".

## Next step

Decide with Juan Carlos whether to propose `consent.failed` to Juan Pablo.
