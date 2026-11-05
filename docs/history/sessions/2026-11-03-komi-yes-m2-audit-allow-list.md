---
date: 2026-11-03
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-72]
branch: fix/backup-audit-meta-keys
tool: Claude Code
pr: "#244"
status: done
---

# Send backup audit events the allow-list accepts and test them with the real validator

## Instruction

Daniel asked for a check of what was left of M1 and M2, and for a plan to finish M2: "can you run a check in sonnet to see whats left of the M1 and M2 ... and if so then do a plan for it so it can be completed". The plan found one blocker, SCRUM-72. After Daniel said "continue", this branch carries the M2 half of the fix. It is stacked on `fix/audit-allow-backup-events` (M13).

## What was done

* `services/api/internal/backup/recovery/service.go`: `recovery_key.set` no longer sends `kdf`.
* `services/api/internal/backup/records/service.go`: `backup.uploaded` sends `record_count` instead of `count`.
* `services/api/internal/backup/approvals/service.go`: approve and reject send `approver_device_id` instead of `approvedBy` and `rejectedBy`. Both still send `method=device_approval`.
* `services/api/internal/backup/reset/`: the local `AuditBackupReset` constant is removed, and the reset uses `audit.BackupReset` from the audit port.
* Tests:
  * The five fake recorders now call `audit.ValidateEvent` and return its error. Those are in the approvals, records, recovery and reset service tests, plus `recAudit` in `postgres/recovery_http_integration_test.go`, which every Postgres integration test uses. `ValidateEvent` is the same check the real audit store runs.
  * The unit tests now use UUID device ids, because the validator rejects ids like `"d1"`.
  * The assertions check the exact meta:
    * `recovery_key.set` has no meta;
    * `record_count` is `"2"`;
    * `approver_device_id` is the approver's id;
    * the reset type is `audit.BackupReset`.

## Result

* Tests:
  * With only the fakes changed, 4 tests fail in approvals (`approvedBy` and `rejectedBy`), 5 in records (`count`) and 1 in recovery (`kdf`). This was checked again by stashing the service changes.
  * With the fix, `go test ./internal/backup/... ./internal/audit/...` passes, and `go build ./...` and `go vet`, with and without `-tags integration`, are clean.
* The Postgres integration tests were compiled but not run, because Docker was not running locally. CI runs them with `make test-integration`.
* Pull request: the top of the SCRUM-72 stack, above the M13 allow-list PR.
* Not checked yet: the flows on the local stack and on a second phone. That waits for both PRs to merge.

## Decisions and problems

* The keys were renamed to ones the allow-list already accepts, so the M13 change stays small.
* `kdf` was dropped instead of being added to the list, because ADR 0002 fixes the Argon2id parameters, so the value never changes.
* The old fakes also hid a second problem: the test device ids were not UUIDs. Production ids come from Postgres and are UUIDs, so only the tests changed.
* Added after the PR opened: the first push failed CI's golangci-lint.
  * The fakes imported `internal/audit`, and depguard allows another module only through `internal/<module>/ports`, even in tests.
  * #243 moved the rules to `audit/ports.ValidateEvent`, and the fakes now call it through the `audit` port alias the tests already import.
  * golangci-lint v2.15.0 now passes on `./...`.
  * Linting with `--build-tags integration` still reports old issues in the Postgres integration tests, which import `internal/identity` to mount that module. CI does not lint with that tag, and those issues were already on develop.
* An audit failure still leaves the action stored, so the key is saved but the client gets a 500 (the "Efecto secundario" in SCRUM-72). With valid events this no longer happens in normal use, and it is out of scope here.

## Next step

When both PRs are merged:

1. Run `make dev` and save the recovery code. Check that it answers 200 and that a `recovery_key.set` row lands in `audit.events`.
2. On a second phone, restore with the code, restore by approval, and reset.
3. Tick the Gate B row, then move SCRUM-62, SCRUM-63 and SCRUM-72 to "Finalizado".
