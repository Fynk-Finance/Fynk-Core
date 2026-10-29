---
date: 2026-10-29
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62, SCRUM-63]
branch: feature/backup-reset
tool: Claude Code
pr: none
status: done
---

# Serve the backup reset

## Instruction

The last backend step of the M2 plan: `POST /backup/reset`, with the email-code rule.

## What was done

* **`reset_http.go`:** 204, 403 `reset_not_allowed` with a fixed text, and 403 `device_not_active`. No ids or times appear in any problem.
* **`module.go`:** the route is behind `auth.Require`. The reset's device port gets the Keycloak session revoker, so removed phones lose their sessions.
* **Test path edits:** with the reset implemented, every backup route is real. The 501 checks in `app_test.go` (M0) and `recovery_http_test.go` now use `/v1/backup/unknown`.
* **`postgres/reset_integration_test.go`:** real identity, backup and Postgres, with a fake Keycloak.
  * Four refusals delete nothing: no reset, a reset 11 minutes ago, a session older than the reset, and a missing session.
  * A reset from the new pending phone removes the records, the key and the approvals, while another user's rows stay. The old phone gets 403 or 410, only its session is revoked, and the new phone is active and reads an empty backup. The audit has `device.removed` and `backup.reset`. A repeat gets 204.
  * A reset from the active phone also works.

## Result

* `make lint-go` and `make test-go` pass, and `gofmt -l` is empty.
* The integration tests pass with `-p 1` on Postgres 16.15.

## Decisions and problems

* The backend side of M2 is complete with this PR. The phone side of the reset comes in `feature/restore-on-new-phone`.

## Next step

Biometric unlock on the phone.
