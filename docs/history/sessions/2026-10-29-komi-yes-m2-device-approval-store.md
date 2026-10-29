---
date: 2026-10-29
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-63]
branch: feature/device-approval-store
tool: Claude Code
pr: none
status: done
---

# Store the device approval requests

## Instruction

Step 3 of the backend plan Daniel approved ("continue"): "the five approval endpoints; 10-minute expiry with the clock; only an active approver". This PR is the storage. The rules, the endpoints and the integration test are the next three PRs.

## What was done

* **Migration 3:** a nullable `idempotency_key` with a unique index on `(new_device_id, idempotency_key)`. A retried create returns the first request, and a request without a key is never deduplicated.
* **`approvals/approvals.go`:** the states, the grant sizes (32-byte ephemeral key, 48-byte wrapped DEK, 12-byte nonce), the 10-minute TTL, and the repository ports.
* **`postgres/approvals.go`:** a per-user advisory lock around each request, `SELECT ... FOR UPDATE` for decisions, the open list with `expires_at > now`, and the grant cleared with one update.

## Result

* `go vet` and `go test` pass on this commit alone. The repository is covered by the integration test PR.

## Decisions and problems

* The implementer's work was split into four PRs to stay near 400 lines.

## Next step

The approval rules (`feature/device-approval-service`).
