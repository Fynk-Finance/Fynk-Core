---
date: 2026-10-28
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: feature/email-reset-stamp
tool: Claude Code
pr: none
status: done
---

# Stamp the time of a password reset with the email code

## Instruction

While planning M2, Daniel chose that "No tengo ninguno de los dos" (lost phone and code) may delete the old backup only after "a password reset with the email code in the last 10 minutes". He then said "continue". The backend needs to know when that happened, and "Cambiar contraseña" must not count because it only needs the password.

## What was done

* **Email-code extension:**
  * `ResetCredentialWithCode` stamps the user attribute `fynkEmailResetAt` (epoch milliseconds) once the reset code is verified;
  * `ResetStamp` holds the name and the format;
  * nothing else writes it: not the registration code, not `UPDATE_PASSWORD`.
* **Admin only:** the realm already has `unmanagedAttributePolicy: ADMIN_VIEW`, so the person can't see or change the attribute anywhere. The realm file is unchanged.
* **`kcadmin.Client.EmailResetAt` and `identity/ports.EmailResets`** let M2 read it. A missing user is `ErrNotFound`, and errors carry only the status code.
* **Tests:**
  * `ResetStampTest` (Java);
  * the kcadmin table tests;
  * a static realm test that the attribute stays admin-only and out of every token mapper;
  * three Keycloak testcontainers tests: a reset with the code stamps it; `kc_action=UPDATE_PASSWORD` doesn't; the person's own token can neither read it nor overwrite it through the account API.
* **`services/keycloak/README.md` and ADR 0007:** a note on the stamp.

## Result

* `mvn verify` passes (inside `docker build --target extension`), as do `make lint-go`, `make test-go` and `make test-keycloak`.

## Decisions and problems

* **Stamped when the code is verified, not when the new password is saved.** The password step is Keycloak's own `UPDATE_PASSWORD` action. Telling a reset apart from the app's change there would need a second extension. The code already proves the mailbox, and the reset finishes in the same browser session.

## Next step

M2's `POST /backup/reset` reads `EmailResetAt` and allows the reset only within 10 minutes.
