---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-9, SCRUM-6]
branch: feature/password-change-and-device-list
tool: Claude Code
pr: none
status: done
---

# Change password from the app, and read and close the linked devices

## Instruction

This is part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". Seguridad (`CfgSeguridad`) has "Cambiar contraseña" and "Dispositivos activos". This branch is the data under that screen; the screen itself is the next branch of the stack. Claude Code (Opus) planned and reviewed. A Sonnet subagent wrote the code. Claude Code added the same-account check, ran the checks again, and split the work into two PRs to keep each one reviewable.

## What was done

* **Change password:**
  * The OIDC adapter has `changePassword()`: `authorize` with `kc_action=UPDATE_PASSWORD`, and Keycloak's `kc_action_status` read from `authorizeAdditionalParameters`.
  * `SessionService.changePassword()` returns `changed`, `cancelled` or `failed`. Keycloak always answers with a new session (the browser is ephemeral, so it asks for the login first). The app keeps the new tokens and closes the old session, so a cancelled change doesn't leave two sessions open.
  * **The same account only.** On that login page someone could sign in with another account. The session compares the `sub` of the new and old id tokens (`subjectOf` in `domain/session.ts`). If they differ or can't be read, it ends the new session, keeps the old one, and returns `failed`.
  * A sign out while the browser is open keeps the app signed out. Concurrent calls share one run.
  * The dev session answers `cancelled`.
* **Profile:** `passwordUpdatedAt` is read from `GET /me` when the API sends it.
* **Devices API:**
  * `list` (`GET /devices`);
  * `remove` (`DELETE /devices/{id}`; a 404 counts as done);
  * `signOutOthers` (`POST /devices/sign-out-others`).
* **`useLinkedDevices`:** the list sorted with this phone first, `gcTime: 0`, and the two actions.
  * If this phone was removed (410), the device service signs out and wipes.
  * If it is unknown (404), the device service registers it again.
* **Domain, pure:**
  * `relativeTime` ("hace 3 meses", "ahora" under 2 minutes);
  * `sortDevices`, `otherDevices` and `sessionsLabel` ("1 sesión", "N sesiones").

## Result

* `make lint-mobile`, `make test-mobile` (593 tests) and `make format-check` pass.
* The Keycloak side of the change is covered by `TestIntegrationAppInitiatedPasswordChange` in #78.
* Not checked on a phone.

## Decisions and problems

* **Why the account check matters:** without it, signing in as someone else on the change page would put that account's tokens on top of this phone's vault.
* **Tokens are only decoded to compare `sub`.** The API still checks the signature of every token.
* **Splitting the work:** the whole Seguridad change was about 1,640 lines. With GitHub stacks, splitting it into the data and the screen costs nothing.

## Next step

`feature/linked-devices-screen`: the Seguridad screen on top of this branch.
