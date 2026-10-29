---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-9]
branch: fix/pending-device-cannot-remove-devices
tool: Claude Code
pr: none
status: done
---

# Only an active device can close other sessions

## Instruction

While planning M2, a security gap turned up in M1. Daniel approved fixing it as part of the M2 plan, then said "continue".

## What was done

* **The gap:** `DELETE /devices/{id}` and `POST /devices/sign-out-others` didn't check the calling device. Someone who only knows the password could log in on a new phone, which starts `pending`, and remove the real phone. That phone then wipes its vault on its next start.
* **`devices/service.go`:**
  * `Remove` takes the caller's device id. A device may always remove itself, even when pending, because that is signing out.
  * Removing another device, or signing out the others, needs an active caller. A pending, removed, unknown or missing caller gets `ErrNotActive`.
  * The check runs in the same transaction and advisory lock as the removal.
  * The caller is checked first, so a pending phone can't probe which device ids exist.
* **`devices_http.go`:** `ErrNotActive` answers 403 `device_not_active`.
  * `DELETE` takes the caller from the verified `X-Device-Id`.
  * `sign-out-others` keeps the raw header, so a removed phone still gets 410 and wipes itself.
* **`identity.yaml`:** the 403 on both operations.
* **`ports/ports.go`, for M2:** the `Devices` port.
  * `Get` returns a device's name, platform, public key and status.
  * `RemoveOthers` is for the backup reset. It removes the other devices, revokes their Keycloak sessions and audits each one.
  * `NewSessionRevoker` reuses the Keycloak admin client.
* **Tests:**
  * service tests: pending and active callers, self-removal, blank, unknown and removed callers;
  * HTTP tests for the 403;
  * port tests;
  * the Postgres HTTP integration test: a pending phone can't remove the active one or sign out the others, a request without a device can't remove one, and a pending phone can remove itself.

## Result

* `make lint-go` passes (0 issues), and so does `make test-go`.
* The integration tests pass on a throwaway Postgres 16.15: identity, migrate, and the Keycloak testcontainers tests.

## Decisions and problems

* **The app is not changed here.** A 403 shows Seguridad's generic "couldn't do it" alert, with no wipe. M2's identity work hides "Cerrar" on a pending phone.
* **Revocation inside the port is best effort,** like the HTTP path. Its error is dropped because it may carry ids.

## Next step

M2's backup reset and device approvals use the `Devices` port.
