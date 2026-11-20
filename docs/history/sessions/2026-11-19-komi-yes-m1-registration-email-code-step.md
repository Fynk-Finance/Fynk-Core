---
date: 2026-11-19
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: feature/registration-email-code-step
tool: Claude Code
pr: "#428"
status: done
---

# Sign-up code step that creates the user (stack #427 → #428 → #429, part 2)

## Instruction

The developer asked that sign-up create the Keycloak user only after the email code is right: "it saves the user before verifying it, it should do it after". This pull request is the second slice. The full record of the session is in `2026-11-19-komi-yes-m1-create-user-after-email-code.md` (#429).

## What was done

* New authenticator `RegistrationEmailCode` (`fynk-registration-email-code`) with its factory. It mails the code to the pending address with the same page, limits and events as `VerifyEmailWithCode`.
* On the right code, the authenticator does three things:
  * it checks the address is still free;
  * it creates the user with the email verified, the stored password hash and the terms attribute;
  * it signs the person in.
* A code mailed to one address is discarded if the pending address changes. A taken address, including a duplicate insert, creates nothing.
* `CodeMailer.sendToAddress` sends to an address that has no stored user yet, through a transient in-memory user.

## Result

* JUnit: 49 tests, 0 failures. `go test ./internal/identity/keycloak/...` passes on this slice alone.
* The step needs a live Keycloak. The integration tests in #429 cover it end to end (`make test-keycloak` passes).

## Decisions and problems

* Review found that the first version did not tie a code to its address, and that is fixed here. The code carries the hash of its address.

## Next step

Review #429, which wires the steps into the realm.
