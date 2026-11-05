---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M4
jira: [SCRUM-22]
branch: feature/consents-revoke-all-reason
tool: Claude Code
pr: none
status: done
---

# Test RevokeAll and record the account_deleted reason

## Instruction

Juan Carlos approved the recommendation to test the `ConsentsRevoker.RevokeAll` that Juan Pablo added in #223 for account deletion, and to record a reason: "Do the revoke all".

## What was done

* `consents/domain`: new reason `ReasonAccountDeleted = "account_deleted"`.
* `consents/service`: `RevokeAll(ctx, userID, reason)` revokes each active and pending consent through the same path as `Revoke` (audit `consent.revoked`, entity notice, 24 hour retries). `Revoke` now calls the same private `revoke` with `user_request`.
* `consents/ports`: `consentsRevoker.RevokeAll` calls the service with `account_deleted`. The `ConsentsRevoker` interface and `NewConsentsRevoker` stay the same, so M13's code does not change.
* Tests: 3 service tests (active and pending revoked with the reason; already revoked, expired and other users' consents untouched; only the active one notifies the entity; an unreachable entity still revokes and schedules the retry; a user without consents), 1 port test (the reason and errors pass through), and 1 integration test of `NewConsentsRevoker` against Postgres.

## Result

* Tests: `go test ./internal/consents/... ./internal/privacy/...` passes. The integration tests of `consents/ports` and `consents/store` pass against Postgres 16. golangci-lint: 0 issues, with and without the `integration` tag.
* Pull request: not opened yet.

## Decisions and problems

* The reason is stored in the consent's `revoked_reason` column, not in the audit event: the M4 prompt says consent audit events carry the provider and the consent id only. The column is in clear and auditable.
* The old loop treated `ErrAlreadyRevoked` as an error to skip, but `Revoke` never returns it. The new loop skips `ErrNotRevocable` instead, for a consent whose term ended between the list and the revoke.
* `make test-integration` still does not run the M4 and M5 store tests (asked of Sofia before), so CI does not run the new integration test either.

## Next step

Tell Juan Pablo (`@juancontrerasp`) in the pull request that account deletion now records `account_deleted`.
