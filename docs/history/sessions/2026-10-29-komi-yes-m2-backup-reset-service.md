---
date: 2026-10-29
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/backup-reset-service
tool: Claude Code
pr: none
status: done
---

# The backup reset rules

## Instruction

Decision 2 of the M2 plan Daniel approved ("Email code reset"): "No tengo ninguno de los dos" needs a password reset by email code in the last 10 minutes. `POST /backup/reset` then deletes the backup and the recovery key, removes every other device and revokes its sessions, activates this phone, and audits `backup.reset`.

## What was done

* **`reset/service.go`:**
  * the caller's phone may be pending or active, but not removed or unknown;
  * the email-code reset must be at most 10 minutes old, and not more than 1 minute in the future;
  * the caller's Keycloak session must have started after the reset, with 60 seconds of skew;
  * then, in order: the backup is deleted, the other devices are removed and their sessions revoked, a pending caller is activated, and `backup.reset` is audited with `method=email_code`. Every step is idempotent, so a retry within the window finishes the job.
* **`postgres/reset.go`:** one transaction takes the records lock and the approvals lock, then deletes the user's records, recovery key and approvals.
* **`backup.reset`** is defined in the backup module. `internal/audit` belongs to M13 and wasn't touched; the constant can move there later.
* **Tests:** every refusal, including the exact window and skew edges, both callers, and a failure at each step.

## Result

* `go vet` and `go test` pass on this commit alone.

## Next step

The endpoint (`feature/backup-reset`).
