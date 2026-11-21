---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5, SCRUM-9]
branch: feature/keycloak-fynk-theme-reset-pages
tool: Claude Code
pr: none
status: done
---

# The password recovery steps, the success page and the error page

## Instruction

Same session as the code page. For the end of the reset flow the developer chose "Pantalla del diseño": a success page, after which the person signs in again with the new password.

## What was done

* **`login-reset-password.ftl`**, step 1 of `Recuperar`, taken from the design code:
  * the email field `username` (form `kc-reset-password-form`);
  * the copy says a code is sent and that it expires in 10 minutes;
  * the step dots, the back button, and "Volver a iniciar sesión".
* **`login-update-password.ftl`**, step 3:
  * `password-new` and `password-confirm` (form `kc-passwd-update-form`);
  * a live checklist that matches the realm policy: 8 or more characters, a letter and a number. The page doesn't know the address, so "not the email" is left to Keycloak's own error.
* **`info.ftl`:**
  * The end of the recovery gets the success page "¡Contraseña actualizada! … Cerramos las sesiones abiertas en otros dispositivos" with "Ir a iniciar sesión". It is recognized by Keycloak's `accountUpdatedMessage` or `skipLink`, with no header and no required actions.
  * Any other info message gets a generic Fynk page.
  * Both keep `kc-info-message`, the id the Go tests look for.
* **`error.ftl`:** the Fynk layout, plus a link back to the app when the client has one.

## Result

* `pnpm typecheck`, `pnpm format-check` and `pnpm build-keycloak-theme` pass. The jar contains the four pages.
* Claude Code looked at the light screenshots of the success page and compared step 1 with `Recuperar.png`.

## Decisions

* **New compositions.** The design export has only step 1 of `Recuperar`. Steps 3 and 4 and the info and error pages follow its style and need design review.

## Problems

* After a reset, Keycloak closes the login session, so "Ir a iniciar sesión" may have no usable URL. One option is a `baseUrl` on the `fynk-mobile` client (`co.fynk.app://`). The PR that puts the theme in the image decides this and checks it in a real Keycloak.

## Next step

* Put the theme in the image and the realm (`loginTheme: fynk`), build it in the Dockerfile, and run the whole integration suite on the themed image, including the enumeration test.
