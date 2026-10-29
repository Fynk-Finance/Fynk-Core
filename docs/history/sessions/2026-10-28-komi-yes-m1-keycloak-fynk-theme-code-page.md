---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5, SCRUM-9]
branch: feature/keycloak-fynk-theme-code-page
tool: Claude Code
pr: none
status: done
---

# The 6-digit code page in the Fynk design

## Instruction

Continues the Fynk theme. The email-code extension's page (`fynk-email-code.ftl`) is shown after "Crear cuenta" (verify mode) and in password recovery (reset mode), in the Fynk design and in light and dark. A Sonnet subagent built this and the reset pages. Claude Code reviewed the work and split it: this branch has the code page, and the next has the reset steps.

## What was done

* **`fynk-email-code.ftl` as a Keycloakify extra page**, declared in `KcContext.ts` with the extension's attributes (`purpose`, `email`, `minutes`, `cooldownSeconds`).
  * It keeps the extension's form contract: `kc-email-code-form`, `code`, the buttons `verify` and `resend`, and the link `kc-email-code-change-link`.
* **Code boxes:** six boxes in IBM Plex Mono drawn over one real input, so paste, the one-time-code autofill, backspace and screen readers work.
  * "Reenviar en m:ss" counts down from the server's `cooldownSeconds`. The server still enforces the cooldown.
* **Verify mode:** the `OnbCorreo` content (email card, lime info box) inside the Fynk layout. This is a new composition that needs design review.
* **Reset mode:** the `Recuperar` header with its step dots, the code, and "Cambiar correo".
* **Shared flow pieces:** a compact header with a back button, the step dots, the info box, new icons, and the styles in `fynk-flow.css`. The colors come from `OnbCorreo.html` and `Recuperar.html`, in light and dark.
* **No account enumeration:**
  * Keycloakify embeds the page's whole data model in the HTML, which on this page includes `auth` and `user`, and those differ between a real account and the decoy.
  * `postBuild.ts`, Keycloakify's build hook, removes both from this page's embedded data. The build fails if Keycloakify changes the generated file so the rule can't be placed.
  * The page reads nothing from `auth` or `user`.

## Result

* `pnpm typecheck`, `pnpm format-check` and `pnpm build-keycloak-theme` pass. The jar contains `fynk-email-code.ftl` with the rule.
* Claude Code checked screenshots in light and dark, in both modes and with errors.

## Decisions

* **Hide `auth` and `user` from this page in the build.** Keycloakify serializes the whole data model, and a React page can't repeat the extension's `<#global auth = {}>`. The build hook is the supported place to fix that.

## Problems

* The rule has not run inside a real Keycloak yet. The branch that puts the theme in the image will run `TestIntegrationUnknownEmailLooksTheSameInTheReset` on it. That test has to ignore the per-session values in the embedded data (session codes, tab ids).
* **Needs JavaScript.** Like every Keycloakify page, this one is drawn by JavaScript.

## Next step

* `feature/keycloak-fynk-theme-reset-pages`: the reset steps 1 and 3, the success page, and the generic info and error pages.
