---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: feature/backup-recovery-key-endpoints
tool: Claude Code
pr: none
status: done
---

# Serve the recovery key endpoints

## Instruction

This follows the recovery key rules in the M2 plan Daniel approved ("continue"): the HTTP side of `PUT` and `GET /backup/recovery-key` and `POST /backup/recovery-key/activate`.

## What was done

* **`recovery_http.go`:**
  * base64 is decoded strictly, with the exact sizes (48, 12, 16, 32);
  * the KDF must be `argon2id` with 65536, 3 and 1, otherwise 400 `invalid_request` naming only the field;
  * the problem codes are `device_not_active`, `recovery_key_not_found`, `proof_mismatch`, `too_many_attempts` and `device_removed`;
  * the proof and the keys are never echoed or logged.
* **`module.go`:** only these three operations of the generated server are mounted, behind `auth.Require`. Every other backup route still answers 501.
* **`backup.yaml`:** a 403 `device_not_active` on `GET /backup/recovery-key` and on activate. The handlers return it, and the contract didn't list it.
* **Tests:**
  * HTTP: every status, no secret text in any problem, 501 for the other routes, 401 without a token.
  * Postgres: the real identity and backup modules, where a pending device is activated with the proof and can then save a recovery key.

## Result

* `make lint-go` passes (0 issues), and so does `make test-go`.
* The integration tests pass with `-p 1` on Postgres 16.15.

## Decisions and problems

* **Only the implemented routes are mounted** from the generated wrapper, and the rest stay on the stub. The generated interface is embedded as nil, so every later PR must mount its own routes.
* **Validation runs before the device check,** so a pending device with a malformed body gets 400, not 403.

## Next step

The records endpoints (`PUT` and `GET /backup/records`).
