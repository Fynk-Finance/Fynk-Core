---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: feature/keycloak-fynk-theme-register
tool: Claude Code
pr: none
status: done
---

# The registration page in the Fynk design

## Instruction

Same session as the login page. Registration follows the design's `Registro`, without the cédula (rule 10). The team decided to keep email, password and terms on the "Crear cuenta" page, and #50 turns that on in the realm.

## What was done

* **`register.ftl`:**
  * the header "Crea tu cuenta", the card title "Regístrate" and the subtitle **"Solo necesitas dos datos para empezar."** (changed copy, because the cédula is gone);
  * the email; the password with the policy hint; the password confirmation that Keycloak 26 requires (new field, needs design review);
  * "Crear cuenta", the terms checkbox (`termsAccepted`) and "¿Ya tienes cuenta? Inicia sesión".
* **Fields and errors:**
  * only the fields the realm asks for are drawn: the optional first and last name don't appear, and hidden profile fields are sent as hidden inputs;
  * errors show under each field and under the checkbox.
* **Terms:** the document names are bold text, not links, because the documents don't exist yet.
* **Dev preview:** `?page=register.ftl` shows the password fields by default, as the realm does; `&password=0` hides them, and `&error=1` shows the terms error.

## Result

* `pnpm typecheck`, `pnpm format-check` and `pnpm build-keycloak-theme` pass.
* Claude Code compared the light and dark screenshots with `docs/design/screens/light|dark/Registro.png` and fixed two things:
  * in dark mode the checkbox showed the browser's grey box; it is now the design's white box;
  * a hint under the email said the password would be set later, which isn't our flow, so it was removed.

## Decisions

* **Password confirmation stays.** Keycloak 26 rejects a registration without `password-confirm`, so the field is kept and labelled "Confirma tu contraseña".

## Problems

* The subagent's branch started before #50, so it read the old README, which said the password is not on the form. The password block depends on Keycloak's `passwordRequired`, so it is correct with either realm.

## Next step

* The code page, the reset pages and the info page in the Fynk design, then the image and realm wiring with the integration suite on the themed image.
