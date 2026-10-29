---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-6]
branch: feature/devices-endpoints
tool: Claude Code
pr: none
status: done
---

# The devices endpoints in the contract and the API

## Instruction

Same plan as the devices service and store. This part adds the endpoints of `docs/modules/M01-identity.md` (`POST /devices`, `GET /devices`, `GET /devices/current`, `DELETE /devices/{id}`), plus `POST /devices/sign-out-others` for the design's "Cerrar todas las demás sesiones" in `CfgSeguridad`.

## What was done

* `contracts/modules/identity.yaml`: the five operations with examples, and the `IdentityDeviceRegistration`, `IdentityDevice` and `IdentityDeviceList` schemas.
  * Problem codes `invalid_device`, `device_key_removed` (409), `device_not_found` (404) and `device_removed` (410).
  * The public key is never returned.
  * The module's example `/identity/health` path is gone.
* `internal/identity/devices_http.go`: the strict-server handlers.
  * The key must be standard base64 of exactly 32 bytes.
  * `current` comes from `X-Device-Id`.
  * Problem details name the field, never the value.
* `module.go`: the routes are mounted behind `auth.Require`; `/me` stays a 501 stub until the profile PR.
* Tests:
  * handler tests with a fake service, covering every status and problem code;
  * an integration test over a real Postgres for the whole flow: register, second pending, list, current, remove, then 410, then sign out the others.
* `apiHooks.test.ts`: it now calls `GET /devices` instead of the removed example path.
* Shared fixes that came out of this branch went to `chore/identity-backend-wiring` (#40), for Sofia:
  * the `oapi-codegen/runtime` module, already listed in ADR 0001;
  * the M0 tests no longer use identity's example path.

## Result

* `make generate`, `go vet` (both tags), `go test ./...`, `make lint-go`, `make lint-mobile` and `make test-mobile` (313 tests) are clean. `make test-integration` passed twice. Claude Code ran everything again itself.

## Decisions

* Removing a device doesn't revoke its Keycloak session yet. The session ids are already returned by the service; the profile PR adds the Keycloak admin client that ends them.

## Problems

* The subagent found two tests outside its scope that still used `/identity/health`, one M0 Go test and one M0 mobile test. Claude Code fixed them in the M0 chore branch and rebased the stack.

## Next step

* `feature/profile-endpoints`: the Keycloak admin client, `GET /me` and `PATCH /me`, and revoking the session of a removed device.
