---
date: 2026-11-03
developer: Daniel Palacios
github: Komi-yes
module: M13
jira: [SCRUM-72]
branch: fix/audit-allow-backup-events
tool: Claude Code
pr: "#243"
status: done
---

# Let the audit allow-list accept the events of the backup module

## Instruction

Daniel asked for a check of what was left of M1 and M2, run with Sonnet, and for a plan to finish M2: "can you run a check in sonnet to see whats left of the M1 and M2 if am not mistaken the M1 is complete and M2 has something left and if so then do a plan for it so it can be completed". He chose to write the small M13 change himself, with Juan Pablo reviewing it as the owner of `internal/audit`. He also asked to keep the Jira statuses up to date.

## What was done

* Two Sonnet agents audited `origin/develop` against the M01 and M02 prompts, the 28 Oct M2 plan, the session logs and the open PRs. Their claims were then checked by hand.
  * M1 is complete in code.
  * In M2, every branch is merged, but SCRUM-72 blocks every backup flow: the audit allow-list rejects M2's events, so the endpoints answer 500.
* Jira: SCRUM-72 was rewritten in the backlog's format and moved to "En curso".
  * It became the story HU-055 under the epic SCRUM-10, with 2 points, assigned to Daniel.
  * The criteria are in Spanish, and Sofia's report is kept under "Detalle técnico".
* `services/api/internal/audit/ports/ports.go`: added the constant `BackupReset = "backup.reset"`.
* `services/api/internal/audit/validation.go`:
  * added `backup.reset` with `method` and `status`;
  * added `method` to `backup.restored`;
  * added `method` and `approver_device_id` to `device.rejected`.
* `services/api/internal/audit/validation_test.go`:
  * `TestAllowListCoversSharedContractEvents` checks that the 21 event types of `00-shared-contracts.md` §4.3 are all on the allow-list;
  * `TestValidateEventAcceptsBackupEvents` runs the exact events M2 will send through `ValidateEvent`.

## Result

* Tests: `go test ./internal/audit/...` passes, and `gofmt` and `go vet` report nothing. golangci-lint is not installed locally, so CI runs it.
* Pull request: the bottom of a `gh stack`, with the M2 key renames on top in `fix/backup-audit-meta-keys`.
* The backup flows still fail until the M2 PR above this one is merged too, because M2 still sends `kdf`, `count`, `approvedBy` and `rejectedBy`.

## Decisions and problems

* Most of the fix is a rename on the M2 side to keys the list already accepts:
  * `count` becomes `record_count`;
  * `approvedBy` and `rejectedBy` become `approver_device_id`;
  * `kdf` is dropped, because its parameters are fixed by ADR 0002.
* M13 only adds what has no equivalent:
  * the `backup.reset` type, which the shared contracts already require;
  * `method`, to tell a restore with the recovery code from one with a device approval;
  * the approver on a rejection.
* None of the new keys hits the list of sensitive words.

## Next step

Rename the keys in `internal/backup`, and make its test fakes run `audit.ValidateEvent`, so a mismatch fails CI.
