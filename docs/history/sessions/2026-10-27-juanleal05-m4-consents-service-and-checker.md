---
date: 2026-10-27
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-20, SCRUM-21]
branch: feature/consents-service-and-checker
tool: Claude Code
pr: none
status: done
---

# Consent use cases, real ConsentChecker and expiry job (M4 step 1, part 3 of 4)

## Instruction

Same session as `feature/consents-domain-rules`. Third of the 4 stacked branches of `feature/consents-backend`.

## What was done

* `internal/consents/service/service.go`:
  * `Create`: records the explicit acceptance as a pending consent. The same `Idempotency-Key` from the same user returns the first consent; a different request with that key is `idempotency_conflict`.
  * `List` and `Get`: only the user's own consents (another user's is "not found"), newest first, with the status as of now (HU-007, "información actualizada").
  * `Active` and `MarkGranted`: the real `ports.ConsentChecker` (shared contracts, section 4.5). `Active` is false for anything not active, past its term or owned by another user.
  * `ExpireDue` and `RunExpiry`: the expiry job, run at once and then every interval until its context ends.
  * Audit: one event per state change (`consent.created`, `consent.granted`, `consent.expired`) with `provider` and `consent_id` only, plus the user and device ids.
  * IDs are UUID v7 (shared contracts, section 1).
* `ports/ports.go`: `New(deps)` returns the real checker, so M5 builds it from the `Deps` it already receives, without importing M4 internals. M0's `LocalChecker` stays.
* `store/memory.go`: in-memory store with the same rules, for tests.
* Tests from the criteria: pending with evidence (HU-006), list and status as of now (HU-007), no activation without evidence or a known text (module test), expiry after `term_days` with a fixed clock, audited once (module test), one audit row per change with no amounts, emails or tokens (module test), idempotency, other users hidden.

## Result

* Tests: 14 service tests pass with `-race`; the whole Go suite and golangci-lint pass.
* Pull request: opened right after this log.
* The branch is about 640 lines, 300 of them tests. It is the smallest split that keeps the use cases and their tests together.

## Decisions and problems

* A failing audit store is logged and does not undo the change. The change is already committed and the consent row keeps its own dates (`created_at`, `granted_at`, `expires_at`), so the evidence is not lost, and M5 never sees a failure after the bank already gave tokens. M13 is asked to confirm this in review.
* `Active` already treats an ended term as inactive, so the daily job only keeps the stored status and the `consent.expired` audit current.

## Next step

`feature/consents-endpoints`: the contract and the HTTP endpoints.
