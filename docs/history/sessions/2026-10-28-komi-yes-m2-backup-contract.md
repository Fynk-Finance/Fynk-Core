---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62, SCRUM-63]
branch: feature/backup-contract
tool: Claude Code
pr: none
status: done
---

# Write the backup module's API contract

## Instruction

Daniel pasted the M2 prompt: "You are building module M2 of Fynk: the encrypted vault on the phone, biometric unlock, the zero knowledge backup of manual data, and moving that data to a new phone." He approved the plan and said "continue". This contract is the plan's first pull request, so the backend and the app can both build on it.

## What was done

* **`contracts/modules/backup.yaml`:** the nine endpoints of the shared contracts §5, plus two new ones decided in planning. M0's health example is removed. The contract covers:
  * the encrypted records: at most 200 per call, an atomic batch, `stale_version`, a 5 MB quota, and a cursor page;
  * the recovery key: PUT only from an active device. GET never returns the proof hash;
  * `POST /backup/recovery-key/activate`: a pending phone proves it opened the wrapped key, with no decryptable answer and 5 tries per hour;
  * `POST /backup/reset`: only after a password reset by email code in the last 10 minutes;
  * the device approvals: create, the pending list for the old phone, the state for the new phone, approve and reject.

  Every operation needs `X-Device-Id`, and every response has an example for Prism.
* **`internal/backup/module.go`:** the generated server isn't mounted yet, so every route answers 501 through `module.Stub`. The implementation pull requests mount it.
* **`internal/app/app_test.go`:** skips backup in the health path test, as it already does for identity.
* **`00-shared-contracts.md`:** the two endpoints in §5, and `backup.reset` in the audit event list (§4.3).
* **`M02-vault.md`:** one line each for the two endpoints.

## Result

* `make generate` and `make lint-go` pass (0 issues), as do `make test-go` and `make format-check`.
* Prism serves the new routes with their examples.

## Decisions and problems

* **Activation by proof (decided with Daniel):** a phone that restores with the code becomes active only if SHA-256 of `HKDF(DEK, 'fynk/device-proof/v1')` matches the hash saved with the recovery key. Otherwise anyone with the password could activate a phone and overwrite the backup and the recovery key.
* **Reset after an email-code password reset (decided with Daniel):** "No tengo ninguno de los dos" deletes the old backup. Requiring the email code means a password alone cannot destroy someone's backup.
* **The approval state enum is its own schema** (`BackupApprovalState`). The inline enum gave oapi-codegen a duplicate type name.
* **No handler is mounted yet,** so no hand-written 501 responses are needed.

## Next step

The backend stack implements the endpoints, and the app builds on the generated types.
