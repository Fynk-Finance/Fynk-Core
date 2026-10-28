---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5, SCRUM-67]
branch: feature/keycloak-email-verification-code
tool: Claude Code
pr: none
status: done
---

# Verify the email with a 6-digit code at sign-up and login

## Instruction

Same session as `feature/keycloak-email-code-core`. The developer: "esta confirmacion deberia ir tanto cuando se va a crear la cuenta como si se quiere recuperar la contraseña". This branch covers account creation and an unverified login. Recovery is the next branch.

## What was done

* **The required action `fynk-verify-email-code`** (`VerifyEmailWithCode`, `VerifyDecision`, `CodeMailer`):
  * it starts for an unverified email and sends a code;
  * it doesn't send again on a page refresh, and a "resend" honors the 60 s cooldown;
  * a wrong code shows the attempts left, the fifth asks for a new code, and after 10 wrong codes in 12 h nothing is sent or checked;
  * the right code marks the email verified and the login continues.
  * The pure decisions are in `VerifyDecision`, with 14 unit tests.
* **Events:** `SEND_VERIFY_EMAIL`, `VERIFY_EMAIL` and the errors `invalid_code`, `expired_code` and `email_send_failed`. The email and username details are removed from these events. On a send failure only one generic line is logged.
* **Pages and emails:** `fynk-email-code.ftl` (login page with form `kc-email-code-form`; HTML and text email with the code and no link) and Spanish and English messages. They work with Keycloak's default theme until the Fynk theme exists.
* **`fynk-realm.json`:**
  * `VERIFY_EMAIL` (the link) is listed but disabled;
  * the code action is enabled;
  * `registration-password-action` has `always_set_password_on_register_form: true`, so "Crear cuenta" asks for the email, the password and the terms, as in the design.
* **`realm_test.go`:** new static checks for these settings.
* **`realm_integration_test.go`:** Keycloak is now built from `services/keycloak/Dockerfile`. Tests:
  * an unverified login gets the code page, a wrong code is refused, and the right code gives `email_verified=true`;
  * registration with the password on the form, where `abcdefgh` is refused, then the code;
  * five wrong codes kill the code;
  * a resend within 60 s sends no second email;
  * the stored events carry neither the code nor the address;
  * the banco-demo realm still loads and logs in from the shared image.
* **`services/keycloak/README.md`:** the extension and the changed settings.

## Result

* `mvn verify`: 33 tests pass. `make test-keycloak`: the whole suite passes, about 40 s with a warm image. The subagent ran it twice and Claude Code once more. `make lint-go` is clean.

## Decisions

* The password is on the registration form, following the team's decision to match the design. Pre-hijacking someone's email stays harmless: an unverified account never gets tokens, and the owner takes it back with the reset flow (next branch), which verifies the email and ends every other session. Keycloak marks this option deprecated, and the README says to check it before upgrading.
* A failure to send the email shows Keycloak's error page instead of `context.failure()`, which Keycloak treats as a denied consent.

## Problems

* The README still said "do not turn on `always_set_password_on_register_form` without a team decision"; it now records the decision.
* Keycloak's own `LOGIN` events still carry the username (the email). That is Keycloak's audit of logins, kept in its own database. The tests only check our events.

## Next step

* `feature/keycloak-password-reset-code`: recovery by code, with the decoy for unknown emails, the logout of other sessions, and the design's success page.
