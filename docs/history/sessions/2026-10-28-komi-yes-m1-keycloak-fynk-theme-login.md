---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: feature/keycloak-fynk-theme
tool: Claude Code
pr: none
status: done
---

# The Fynk layout and the login page in the Keycloak theme

## Instruction

M1's branch 2: the Keycloak pages look like the design's `Login` and `Registro`, in light and dark, following the browser's setting. A Sonnet subagent built them, and Claude Code reviewed and split the work. This branch has the shared layout and the login page; the registration page comes in the next branch.

## What was done

* **Theme variables** `--fk-*`, named after the app's tokens (`tokens.ts` in #14):
  * light values from `docs/design/sources/light/Login.html`, dark values from `dark/Login.html`, switched with `prefers-color-scheme`;
  * error colors from the app's tokens, because the design has no error state (needs design review).
* **Shared layout:**
  * the blue header with its squares and shine, the logo SVG, the lime band and the white card with its rise animation, all taken from the design code;
  * the animations stop under `prefers-reduced-motion`;
  * a responsive column instead of the design's fixed 390×844 frame.
* **Login (`login.ftl`):** "Hola de nuevo" / "Inicia sesión", the email and password fields with icons and the eye toggle, "¿Olvidaste tu contraseña?", "Ingresar", and "¿No tienes cuenta? Regístrate".
  * There is no "Huella o Face ID" button (design inventory row 2).
  * Keycloak's ids and names are kept (`kc-form-login`, `username`, `password`, `credentialId`, `kc-login`), so the integration tests still find them.
* **Fonts:** Plus Jakarta Sans and Space Grotesk from `@fontsource`, inside the jar.
* **Dev preview:** `pnpm dev` with `?page=login.ftl&error=1`, using Keycloakify's mock context. The mock is not part of the built theme.

## Result

* `pnpm typecheck`, `pnpm format-check` and `pnpm build-keycloak-theme` pass.
* Claude Code compared screenshots at 390×844 in light and dark, plus an error state, with `docs/design/screens/light|dark/Login.png`. They match apart from the removed fingerprint button and the real font.

## Decisions

* **The split.** The subagent built login and registration together, about 1,200 lines. Claude Code split them: this branch has the layout and login, the next one registration.
* **Touch targets.** The eye button is 44 px instead of the design's 40 px.

## Problems

* The design PNGs were rendered with a fallback font, so the letters differ slightly. Sizes and positions match.

## Next step

* `feature/keycloak-fynk-theme-register`: the registration page.
