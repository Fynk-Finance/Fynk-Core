---
date: 2026-10-29
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-63]
branch: feature/device-approval-service
tool: Claude Code
pr: none
status: done
---

# The device approval rules

## Instruction

Step 3 of the backend plan: "approve calls ActivateDevice; audit device.approved and device.rejected; tests for 'expired cannot approve' and 'not active cannot approve'".

## What was done

* **Create:** only a pending phone asks. An active phone gets `ErrAlreadyActive`, and a removed or unknown one `ErrNotActive`. The public key comes from identity, never from the request. A new request expires the phone's older open ones.
* **Pending list:** only for an active phone, newest first, skipping requests whose phone was removed or is no longer pending.
* **Get:** only the phone that asked can read its request; any other caller gets not found. A request past its 10 minutes reads as expired. **The wrapped DEK is returned once:** the same transaction clears it and audits `backup.restored` with `method=device_approval`, so a failed audit keeps the key for a retry.
* **Approve and reject:** only an active phone. Not found, not pending, or expired (410) are checked under a row lock, and the new phone must still be pending. Approving stores the grant and activates the new phone before the commit, so a failed activation leaves the request pending. `device.approved` and `device.rejected` carry the method and the deciding device, never key material.
* **Tests:** every rule with fakes and a fixed clock.

## Result

* `go vet` and `go test` pass on this commit alone.

## Decisions and problems

* **An expired request is stored as expired, and then 410 is returned.** The status is committed first, because an error inside the transaction would roll it back.
* **Known gap:** activation runs on identity's own connection. If the approval's commit fails after it, the phone is active and the request stays pending. That phone can still restore with its recovery code.
* **An approved grant never read** stays until the new phone reads it. Only that phone's private key can open it.
* This PR is 789 lines, 522 of them tests.

## Next step

The endpoints (`feature/device-approval-endpoints`).
