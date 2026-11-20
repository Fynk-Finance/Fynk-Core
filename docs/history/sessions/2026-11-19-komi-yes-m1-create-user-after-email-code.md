---
date: 2026-11-19
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: feature/create-user-after-email-code
tool: Claude Code
pr: "#429 (stack #427 → #428 → #429)"
status: done
---

# Sign-up creates the Keycloak user only after the right email code

## Instruction

While testing the app against the staging deployment (`habenly.site`), the code email never arrived. Signing up again with the same email then said the account already existed. The developer asked: "it saves the user before verifying it, it should do it after". Of the three options offered, they chose to keep the same pages and create the user only after the code.

## What was done

* `services/keycloak/extensions/email-code/`:
  * Three form steps replace Keycloak's `registration-user-creation`, `registration-password-action` and `registration-terms-and-conditions`. They are `RegistrationUserPending`, `RegistrationPasswordPending` and `RegistrationTermsPending`, registered in the new `FormActionFactory` service file.
  * The form steps keep Keycloak's checks and page but create no user. The profile, the password and the terms time wait in the browser's authentication session. The password is kept only as a hash made with the realm policy, never in plain text.
  * New authenticator `RegistrationEmailCode` (`fynk-registration-email-code`). It sends the code to the pending address with the same page, limits and events as `VerifyEmailWithCode`. On the right code it does three things:
    * it checks the address is still free;
    * it creates the user with the email verified, the stored hash and the terms attribute;
    * it signs the person in.
  * `PendingRegistration` encodes and decodes the pending notes. It also computes the limits subject: a SHA-256 of the realm and the lowercased email, never the raw address.
  * `CodeMailer.sendToAddress` sends to an address that has no stored user yet, through a transient in-memory user.
* `services/keycloak/realms/fynk-realm.json`: the registration form uses the three pending steps, and "fynk registration" runs `fynk-registration-email-code` after the form.
* Tests:
  * JUnit `PendingRegistrationTest`.
  * `realm_test.go` checks the flow and the provider ids.
  * `realm_integration_test.go` runs against a real Keycloak and Mailpit. It covers six cases:
    * no user exists until the right code;
    * the right code creates a verified user whose password logs in;
    * an abandoned sign-up leaves the email free;
    * wrong and malformed codes create nothing;
    * an address taken between the form and the code gives an error and no second user;
    * a code mailed to one address never verifies another.
* `docs/adr/0007-email-codes.md` and `services/keycloak/README.md` amended.

## Result

* JUnit: 49 tests, 0 failures. Go static realm tests pass. `make test-keycloak` passes against Keycloak 26.8.1. golangci-lint, with and without the `integration` tag, reports 0 issues. `go vet` and `gofmt` are clean.
* Pull requests: stack #427 (pending form steps) → #428 (code step) → #429 (realm wiring, tests and docs).
* Accounts left unverified by the old flow still get the code at login through `VerifyEmailWithCode`.

## Decisions and problems

* The developer chose "create only after the code" over replacing unverified accounts or reordering the pages, so the Registro design stays the same.
* Review found that the first version did not tie the code to its address. A code mailed to A could verify a sign-up later switched to B in the same session. The code now carries the hash of its address, and a new form submit clears every pending note. Keycloak 26.8.1 already refuses the stale form re-post (`login-page-expired.ftl`), so the binding is covered by the JUnit test, and the integration test checks the refusal.
* The 60 s resend cooldown is now per address, so a second browser signing up with the same email within 60 s must wait before it gets its code.
* Staging problems found in the same session belong to M14 and were reported to its owner:
  * the Keycloak SMTP settings still pointed to Mailpit;
  * the database had no migrations;
  * the Keycloak admin secret no longer matched the admin password;
  * SES is still in sandbox.
  PR #425 adds the SES settings and runs migrations on deploy. The migrations were also run once by hand on 2026-11-19.

## Next step

After the stack merges, deploy the new Keycloak image to staging and update the live `fynk registration` flow, because the realm is not imported again. SES production access is still needed before codes reach addresses that are not verified.
