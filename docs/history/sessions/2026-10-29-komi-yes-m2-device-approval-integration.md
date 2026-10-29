---
date: 2026-10-29
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-63]
branch: test/device-approval-integration
tool: Claude Code
pr: none
status: done
---

# Run the device approval flows on Postgres

## Instruction

Step 3 of the backend plan, its integration test: "expired cannot approve", "not active cannot approve", through the real modules.

## What was done

* **`postgres/approvals_integration_test.go`:**
  * **approve:** a real pending phone asks, the active phone lists and approves it, and the new phone becomes active and can upload records. The first read returns the wrapped DEK, the second doesn't, and no row keeps it. The audit types are checked.
  * **reject:** the new phone stays pending and gets 403 on records.
  * **expiry:** at exactly 10 minutes the list is empty, approve and reject get 410, and a new request can be approved.

## Result

* `make test-integration` passes with `-p 1` on Postgres 16.15.

## Next step

The backup reset (`feature/backup-reset`).
