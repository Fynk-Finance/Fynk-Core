---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-9]
branch: feature/keycloak-change-password-page
tool: Claude Code
pr: none
status: done
---

# Draw Keycloak's password page for "Cambiar contraseña" from the app

## Instruction

This is part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". The Seguridad screen (`CfgSeguridad`) has a "Cambiar contraseña" row. The plan opens Keycloak with `kc_action=UPDATE_PASSWORD` in the system browser. The account console has no Fynk theme, so it is not used. Keycloak shows `login-update-password.ftl` for this, and the theme drew that page only as step 3 of the recovery. Claude Code (Opus) planned and reviewed. A Sonnet subagent wrote the change, and Claude Code ran the checks again itself and took the screenshots.

## What was done

* **`theme/src/login/pages/UpdatePassword.tsx`:** when Keycloak flags the page `isAppInitiatedAction`:
  * the change copy "Cambiar contraseña" / "Elige tu nueva contraseña", with no recovery steps;
  * a hidden `logout-sessions=on`, so the other sessions end, as the subtitle says;
  * a "Cancelar" button that submits `cancel-aia=true`.
* **On both variants:** Keycloak's global message shows only when it is an error. The warning "Tienes que cambiar tu contraseña." only repeated the title. The email theme screenshots had shown it.
* **Other files:**
  * `strings.es-CO.ts`: the new copy, marked for design review;
  * `fynk-flow.css`: the link style for a submit button;
  * `dev-preview.ts`: `&aia=1`;
  * the README.
* **Integration tests:**
  * `TestIntegrationAppInitiatedPasswordChange`. A logged-in browser opens the change and gets the page flagged AIA, then saves a new password. It lands back in the app with a code that gives tokens. The new password works and the old one doesn't. Another, earlier session's refresh token gives `invalid_grant`.
  * `TestIntegrationAppInitiatedPasswordChangeCanBeCancelled`. Keycloak answers a cancel with a code and `kc_action_status=cancelled` (no `error`), and the old password still works.

## Result

* `pnpm typecheck` and `pnpm format-check` (theme), `make lint-go`, `make format-check` and `make test-keycloak` pass.
* Screenshots of the change page in light and dark, from the theme's preview.

## Decisions and problems

* **The other sessions always end on a change, with no checkbox.** The recovery does the same, and the page says so.
* **The app must treat `kc_action_status=cancelled` as "nothing changed".** The cancel comes back as a code, not an error. That goes in the Seguridad screen.

## Next step

`feature/linked-devices-screen` (Seguridad), which opens this page.
