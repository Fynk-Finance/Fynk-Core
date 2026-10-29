---
date: 2026-10-29
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-63]
branch: feature/device-approval-endpoints
tool: Claude Code
pr: none
status: done
---

# Serve the device approval endpoints

## Instruction

Step 3 of the backend plan: the HTTP side of the five `/device-approvals` operations.

## What was done

* **`approvals_http.go`:**
  * create answers 201, 409 `device_already_active`, or 403 `device_not_active`, and an Idempotency-Key over 128 characters gets 400;
  * the grant is decoded with strict base64 and exact sizes, and a 400 names only the field;
  * the problem codes are `approval_not_found`, `approval_not_pending` and `approval_expired`.
* **`module.go`:** the five routes are mounted behind `auth.Require`. **The stub is now mounted first.** It handles the bare `/device-approvals` for every method, and chi lets a later route of the same pattern replace it, so mounting the stub last had turned `POST /device-approvals` into a 501.
* **`app/app_test.go` (M0):** the stub path of the backup module is now `/v1/backup/reset`, the last route still stubbed.
* **Tests:** every status of the five operations, and no base64 key text in any problem.

## Result

* `make lint-go` and `make test-go` pass.

## Next step

The Postgres integration test (`test/device-approval-integration`).
