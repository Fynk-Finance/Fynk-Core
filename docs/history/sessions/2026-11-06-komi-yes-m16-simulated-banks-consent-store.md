---
date: 2026-11-06
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-73]
branch: feature/simulated-banks-consent-store
tool: Claude Code
pr: none
status: done
---

# Banco Demo: token registry and per-entity consents in the store

## Instruction

Daniel said "continue" to step 4 of the approved simulated banks plan: "consents per entity, and the token-to-consent fix". Step 4 came back at 812 changed lines, so it was split by layer into three pull requests: store (this one), oauth and api.

## What was done

* `internal/store`: a token registry (`IssueToken`, `LookupToken`; an expired token counts as missing), `CreatePendingConsent` and `ActivateConsent`. `ActivateConsent` sets the customer and fails with `ErrNoProductsAtEntity` when the customer has no account at the consent's entity.
* `GetAccounts` and `GetTransactions` read only the consent's customer and entity. A pending consent gives `ErrConsentNotAuthorized`. An account that exists but is outside the consent gives `ErrAccountNotInConsent`, and one that exists nowhere gives `ErrAccountNotFound`.
* `internal/domain`: `Consent.ProviderID` and the status `pending`.
* The seeded `consent-demo-001` keeps an empty `ProviderID`, which means every entity of the demo user. It is dev only.
* `store.go` was formatted with `gofmt -w` because the error block was already misaligned.
* Tests in `internal/store/store_test.go`.

## Result

* `go test ./...`, `go vet ./...` and `gofmt -l .` in `services/bank-simulator` pass on this commit alone. Nothing calls the new functions yet, so the behavior does not change.
* Pull request: see the stack.

## Decisions and problems

* Code by a Sonnet subagent, reviewed by Opus. The split into three PRs was done in review.

## Next step

The oauth slice: PAR with `entity`, opaque registered tokens, and refresh and revoke by lookup.
