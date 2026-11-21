---
date: 2026-11-20
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: fix/registration-password-fields
tool: Claude Code
pr: none
status: done
---

# Sign-up form always asks for the password

## Instruction

The developer reported from staging: "now the register page just lets the user put the email and not the entire register form with the password and confirm password". Later in the session they also reported that the app showed "No pudimos abrir tu bóveda" after login.

## What was done

* Fetched the live staging sign-up page (`auth.habenly.site`): it rendered `register` without `passwordRequired`, so the theme drew only the email field.
* Read Keycloak 26.8.1's `RegistrationPassword`: while email verification is on, it sets `passwordRequired` and runs the password checks only when its config `always_set_password_on_register_form` is `true`. Otherwise it hides the fields and its `validate` accepts any form, even without a password. The live staging realm, edited by hand after the SCRUM-5 flow change, has the pending password step without that config.
* `RegistrationPasswordPending` now overrides `buildPage` (always sets `passwordRequired`) and `validate` (Keycloak's checks: missing password, different confirmation, realm password policy, without the skip). It no longer depends on the config.
* New `RegistrationPasswordPendingTest` (5 tests) runs the step with no config and email verification on: the page asks for the password, a missing password, a different confirmation and a policy error are rejected, a valid password passes.
* `services/keycloak/README.md` and `docs/adr/0007-email-codes.md` say the step no longer depends on the deprecated option.

## Result

* Tests: `mvn -B verify` in `services/keycloak/extensions/email-code`: 54 pass, 0 fail. The 5 new tests failed before the change (4 of them) and pass after.
* Pull request: not opened yet.
* After merge and Deploy Staging, the new Keycloak image shows the password fields on staging without any manual realm edit.

## Decisions and problems

* The step ignores the config instead of asking for a manual realm fix: the hidden-password mode is against account pre-hijacking, which cannot happen here because no user exists until the right email code. A hand-edited realm can no longer hide the password.
* While the bug was live, a staging sign-up could finish without a password. Those accounts (if any) cannot log in; not checked in this session.
* The "No pudimos abrir tu bóveda" screen is not an app bug. The RDS-managed master secret rotated automatically at 03:12 UTC on 21 Nov. The API task started before that kept the old password, so every database call failed with `28P01` and `POST /v1/devices` returned 500, which the lock screen shows as the unknown error. Keycloak reads the same secret. Reported to the M14 owner: redeploy the API and Keycloak services, and decide how rotation is handled.

## Next step

Open the pull request, and after the staging redeploy check that "Crear cuenta" shows the password fields.
