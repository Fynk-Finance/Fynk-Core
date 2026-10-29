# ADR 0007: Email verification and password reset with 6 digit codes

* Status: accepted
* Date: 2026-10-27 (decision), written 2026-10-28
* Owner: M1 Identity (Daniel Palacios / `@Komi-yes`)
* Jira: SCRUM-5 (HU-001), SCRUM-9 (HU-005), SCRUM-67 (HU-050)

## Context

The design (`Registro`, `OnbCorreo`, `Recuperar`) asks for a 6 digit code sent by email, both to verify the email at sign up and to recover the password. Keycloak 26.8.1 only sends links for both: `VERIFY_EMAIL` and the `reset-credential-email` authenticator. This was open item 2 in `CLAUDE.md`.

## Decision

The team decided to follow the design. A Keycloak extension in this repository, `services/keycloak/extensions/email-code/`, does it. The Keycloak Dockerfile builds it, runs its unit tests and installs it.

* **Sign up and login of an unverified email** use the required action `fynk-verify-email-code`, which replaces the link action `VERIFY_EMAIL` (that one is listed but disabled). The registration form takes the email, the password and the terms ("Crear cuenta"). The code page follows, and the app gets a session only after the right code.
* **Password reset** uses the flow `fynk reset credentials`: `reset-credentials-choose-user`, then `fynk-reset-credential-code`, then `reset-password`. After the new password the person sees the success page ("¡Contraseña actualizada!") and signs in again from the app.
* **No onboarding email step.** Because the email is verified before there is a session, the onboarding email step (`OnbCorreo` in M3) and the `EmailVerificationStep` component are dropped. The endpoint `POST /me/verification-email` is dropped as well: no signed in user has an unverified email, and changing the email is not in the design (`UPDATE_EMAIL` is off). If email change is added one day, it uses the same Keycloak code page.
* **The pages and emails** are drawn by the `fynk` theme (`services/keycloak/theme/`).

## Security rules

* **Code:** 6 digits from `SecureRandom`.
  * It is kept only in the browser's authentication session (the auth note), as a salted SHA-256 hash with its expiry and attempt count. So it is bound to that browser and never stored on the user.
  * It is compared in constant time.
* **Limits:**
  * 10 minutes per code (`actionTokenGeneratedByUserLifespan`);
  * 5 wrong attempts per code;
  * per user, across browsers: a new code at most every 60 s, and at most 10 wrong codes in 12 hours. When that budget is used up, nothing is sent or checked until the window ends.
* **No lockout by others.** Wrong codes do not count toward Keycloak's brute force lock, so nobody can lock someone else's login with them.
* **No account enumeration on reset.** An email without an account, or with a disabled one, gets a decoy with the same pages, messages, cooldown and wrong code budget. No email is sent, and every code is refused.
* **A right reset code:**
  * marks the email as verified (owning the mailbox proves it), which also takes back an account someone pre-registered with that email;
  * ends every other session of the user;
  * never touches the vault key (HU-005, architecture rule 3).
* **Nothing sensitive is logged or stored in events.** The code, the hash, the address and the user name never reach the logs or the stored events: `SEND_VERIFY_EMAIL`, `VERIFY_EMAIL`, `SEND_RESET_PASSWORD`, `RESET_PASSWORD`, and the errors `invalid_code`, `expired_code`, `email_send_failed`.
* **The emails carry no link and no remote image.**

## Consequences

* **We own Java code inside Keycloak.**
  * Each Keycloak upgrade needs the extension's unit tests and the integration suite (`make test-keycloak`) to pass.
  * The registration form needs the deprecated option `always_set_password_on_register_form` (see `services/keycloak/README.md`). Check that it still exists before upgrading Keycloak.
* **Known limitation, response time.** A real account's reset page sends an email and the decoy doesn't, so the real one can answer a little slower. Keycloak's own link flow has the same property. Sending the email off the request thread would remove it. It is recorded here as a finding, not fixed in the MVP.
* **Staging (M14) must give Keycloak the SMTP settings,** or no code can be sent.
