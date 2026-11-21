---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/revoke-device-sessions
tool: Claude Code
pr: none
status: done
---

# Removing a device ends its Keycloak session

## Instruction

Same plan as the profile endpoints. `docs/modules/M01-identity.md`: "`DELETE /devices/{id}` (also revokes that device's Keycloak session)". The design's "Cerrar todas las demás sesiones" in `CfgSeguridad` does the same for every other device.

## What was done

* **`devices_http.go`:** after `DELETE /devices/{id}` and `POST /devices/sign-out-others`, the handlers end the Keycloak session of every removed device, using the admin client's `DeleteSession`.
  * Devices with no session id are skipped.
  * It is best effort. A failure is logged with a fixed message, with no ids and no error text, and the answer stays 204.
  * The revocation runs on a context that the client can't cancel, so an app that hangs up right after the request doesn't leave the session open. Each call keeps the client's 5 s timeout.
* **`module.go`:** the admin client is also the revoker.
* **Tests:** the right ids are revoked; empty ids are skipped; a failure still gives 204 and logs no ids; a cancelled request still revokes.
  * Claude Code checked that the last test fails without the fix.
  * The admin client PR's integration test shows that `DeleteSession` makes the refresh token fail with `invalid_grant`.

## Result

* `go vet` with both tags, `go test ./...` and `make lint-go` are clean.

## Decisions

* **Revocation on its own context.** The subagent's version used the request context. Claude Code changed it during the review, because the device is already removed when the revocation runs.

## Problems

* None.

## Next step

* A chore PR for Sofia (M0) that wires the devices checker in `cmd/api/verifier.go`, so a removed device's token loses its device id at once.
