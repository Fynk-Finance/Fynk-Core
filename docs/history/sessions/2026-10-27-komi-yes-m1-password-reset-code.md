---
date: 2026-10-27
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-9]
branch: feature/keycloak-password-reset-code
tool: Claude Code
pr: none
status: done
---

# Recover the password with a 6-digit code

## Instruction

Same session as the email verification branch. The developer: "esta confirmacion deberia ir tanto cuando se va a crear la cuenta como si se quiere recuperar la contraseña". For the end of the flow the developer picked "Pantalla del diseño": a success page, and the person signs in again with the new password.

## What was done

* **The authenticator `fynk-reset-credential-code`** (`ResetCredentialWithCode`, `ResetDecision`) runs between Keycloak's `reset-credentials-choose-user` and `reset-password`:
  * it uses the same code page as the verification, the same limits (60 s resend, 5 attempts, 10 failures in 12 h) and its own budget;
  * the page has "Cambiar correo", which restarts the flow.
* **No account enumeration:**
  * an email without an account (or a disabled one) gets a decoy. It shows the same page and messages, follows the same cooldown and budget (keyed by a SHA-256 of the realm and the address) and stores a code note, but sends nothing and refuses every code;
  * the layout's "attempted username" block is hidden for the reset, because it only showed when the account existed.
* **A right code:**
  * marks the email as verified, so the owner of a mailbox takes back an account that somebody else pre-registered;
  * ends every other session of the user;
  * after the new password, ends on Keycloak's info page without logging in.
  * Keycloak's `AuthenticatorUtil.logoutOtherSessions` doesn't accept an authenticator context, so its steps are repeated with public APIs.
* **`fynk-realm.json`:** the flow `fynk reset credentials`, bound as `resetCredentialsFlow`. Keycloak's link authenticator is used nowhere.
* **Tests:**
  * `ResetDecisionTest`: the decoy subject, and a decoy that reacts exactly like a wrong code, even to the right code;
  * `realm_test.go`: the flow, its order and that the link authenticator is not used;
  * `realm_integration_test.go`:
    * the whole reset, including a wrong code, the password policy, the info page, new password in and old password out, and the old session's refresh token refused;
    * an unknown email that gets a page of the same shape and no email;
    * an unverified account that becomes verified.
  * The tests of the reset link are gone.
* **`services/keycloak/README.md`:** the recovery flow and its security rules.

## Result

* `mvn verify` passes 39 tests. `make test-keycloak` passed twice for the subagent and once more for Claude Code. `go vet` (both tags) and `make lint-go` are clean.

## Decisions

* The other sessions end when the code is accepted, not after the new password. Owning the mailbox is what proves who the person is.
* The decoy budget is keyed by the typed address, so trying many codes against an unknown email is limited the same way as against a real one.

## Problems

* One difference remains: the real path sends an email and takes longer. Keycloak's own link flow has the same gap, and the README says so.
* Anyone who knows an address can spend its 10 failures and block that person's recovery for up to 12 hours. The team accepted this trade-off when it chose the limits.
* `reset-credentials-choose-user` is Keycloak's, and its own `RESET_PASSWORD` error events still carry the typed username.

## Next step

* `chore/add-keycloakify` and the Fynk theme for the login, sign-up, code and reset pages, in light and dark.
