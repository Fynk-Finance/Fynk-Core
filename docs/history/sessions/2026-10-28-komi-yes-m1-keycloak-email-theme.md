---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5, SCRUM-9]
branch: feature/keycloak-email-theme
tool: Claude Code
pr: none
status: done
---

# Send the 6-digit code emails with a Fynk email theme, and check the whole stack end to end

## Instruction

This is part of the plan to "finish M1 by finishing the pending task that we left until sofia's PRs were merged". The developer asked to check what was still on hold in the previous plan. Two things were: the theme's email templates, and a run on the real local stack. Claude Code (Opus) planned and reviewed. A Sonnet subagent wrote the theme, and Claude Code ran every check again itself and did the stack run.

## What was done

* **`services/keycloak/theme/src/email/` (new):** a plain FreeMarker `email` theme `fynk`.
  * Keycloakify 11 copies a folder that holds a `theme.properties` into the same jar.
  * It overrides only the code email (`html/` and `text/fynk-email-code.ftl`) and the Spanish messages. Every other email falls back to `base`.
  * The HTML uses a table layout with inline CSS and a text wordmark. It has no links and no images, and a `<style>` block for dark mode with the colors of `fynk-variables.css`.
* **Realm:** `emailTheme: fynk`, with a static test in `realm_test.go`.
* **README:** a paragraph in the Theme section.
* **Integration test `TestIntegrationCodeEmailsUseTheFynkEmailTheme`:** it reads the verification email and the reset email from Mailpit. It checks the Spanish subject, the same 6 digits in the HTML and the text, the expiry, heading and footer, and that neither body has a link or an image.
* **Test fix in `TestIntegrationUnknownEmailLooksTheSameInTheReset`:**
  * The subagent saw it fail once with `cooldownSeconds "59" != "60"`. Claude Code traced it: the wrong-code page shows the seconds left of each browser's own cooldown, and the test's real and decoy resets start a moment apart.
  * This is a test race, not a difference between a real account and a decoy: both pages count down from their own start in the same way.
  * The count is now checked on its own (1 to 60) and left out of the comparison. The extension is unchanged.
* **Dark email fix,** found in the screenshots: the dark override removed the card's lime top line, and the page under the card stayed light.

## Result

* `docker build services/keycloak` passes (Maven tests and theme build). The jar holds `theme/fynk/email/...`.
* `make lint-go`, `make format-check` and `make test-keycloak` pass, including the new test.
* **Stack run** (`make dev`, script in the session scratchpad): 20 checks, all pass.
  * Registration lands on the code page, the email is themed, the right code gives tokens with `email_verified`.
  * `GET /v1/me` answers with the masked email, so the admin client works in compose.
  * The first device is active and a second one pending. Removing the second ends its Keycloak session (its refresh gives `invalid_grant`), and it then gets 410.
  * The reset goes through the email, the code, the new password and the success page. The session from before the reset is gone, and the new password signs in.
* **Screenshots** of the real reset pages in dark (steps 1 to 4) and of the email in light and dark. They match the design.

## Decisions and problems

* **Postgres port.** `make dev` could not bind port 5432 on this machine, because a local PostgreSQL service already uses it. For this run only, a compose override in the scratchpad moved it to 55432. Nothing in the repo changed.
* **Two things the screenshots showed, left for later:**
  * The "Espera N segundos" notice paints the code boxes red as if the code were wrong.
  * The reset's step 3 shows Keycloak's "Tienes que cambiar tu contraseña." banner, which repeats the title.

  Both are in the theme. The banner goes with the change-password page branch, which touches that page.

## Next step

`feature/keycloak-change-password-page`: the app-initiated "Cambiar contraseña" variant of `UpdatePassword.tsx`.
