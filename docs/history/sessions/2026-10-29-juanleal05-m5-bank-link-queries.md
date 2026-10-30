---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-44, SCRUM-22]
branch: feature/bank-link-queries
tool: Claude Code
pr: none
status: done
---

# Consent-checked bank queries, refresh, nonces and rate limit (M5 step 2, part 8)

## Instruction

Same session as `2026-10-29-juanleal05-m5-bank-link-settings.md`. Key sentence: "Then let's continue with M5 step 2 as better as possible." The developer also asked to look at the CI error of #131.

## What was done

* `internal/bank/service/queries.go`: before every bank call, a trusted device, 30 queries a minute per user, the link of that user and device, and the consent still active. When the consent ended (in Fynk or at the bank) the link ends and the answer is 409 `consent_revoked`.
  * `Accounts` audits `bank.sync` with the accounts count; failures audit `bank.sync_failed` with the error code.
  * `Refresh` needs the link's current refresh token (its fingerprint), then rotates it; `bank.token_refreshed`.
  * The bank's own 429 is passed back with its `Retry-After`.
* `server.go` and `module.go`: the query and refresh endpoints, 429 with `Retry-After`, and a `X-Request-Nonce` check on every `POST /bank/*` (400 `nonce_required`, 409 `replayed_request`).
* Tests: a refresh token of another link is rejected, the old token stops working after a refresh, a revoked consent answers 409 and ends the link, another user or device gets `link_not_found`, the 31st query gets 429, a replayed nonce is rejected; and the same over HTTP.

## Result

* Tests: `make lint` and `make test` pass on the whole stack. The Postgres and Redis tests pass against Postgres 16 and Redis 7 in Docker.
* Pull request: not opened yet.

## Decisions and problems

* **The #131 CI "failure" was not a code problem.** `gh stack submit` starts two CI runs for the same commit when it opens a pull request. The workflow's concurrency rule cancels one, and its `CI passed` job fails on purpose for a cancelled run. The other run passed, and it is the one that counts. It can be avoided in M0's workflow (for example, skip `CI passed` when the run itself was cancelled). That is Sofia's call, so nothing was changed.
* **`link_id` is not in M13's allow-list for `bank.sync_failed`,** so that event carries only the provider, the error code and the status.
* **Banco Demo has no authorization page yet,** so the whole link cannot run end to end. Everything is tested against a fake provider and the stores against real Postgres and Redis.

## Next step

Review and merge this stack bottom-up. Then M5 step 3 (the phone opens the portal and keeps the tokens), once M2's vault and M16's authorization page exist; and the Bancolombia spike.
