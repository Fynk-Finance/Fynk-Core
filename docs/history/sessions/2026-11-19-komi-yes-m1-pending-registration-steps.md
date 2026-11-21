---
date: 2026-11-19
developer: Daniel Palacios
github: Komi-yes
module: M1
jira: [SCRUM-5]
branch: feature/pending-registration-steps
tool: Claude Code
pr: "#427"
status: done
---

# Registration form steps that wait for the email code (stack #427 → #428 → #429, part 1)

## Instruction

The developer asked that sign-up stop saving the Keycloak user before the email is verified: "it saves the user before verifying it, it should do it after". This pull request is the first slice of that work. The full record of the session is in `2026-11-19-komi-yes-m1-create-user-after-email-code.md` (#429).

## What was done

* `RegistrationUserPending`, `RegistrationPasswordPending` and `RegistrationTermsPending` keep Keycloak's checks and page but create no user. They are registered in the new `FormActionFactory` service file.
* The profile, a hash of the password made with the realm policy (never the plain password) and the terms time wait in the browser's authentication session.
* `PendingRegistration` encodes and decodes those notes and computes the limits subject, a SHA-256 of the realm and the lowercased email. It also ties a code to the address it was sent to.
* `PendingRegistrationTest` covers the round trips, damaged notes, that the hash is never printed, the limits subject and the code-to-address binding.

## Result

* JUnit: 49 tests, 0 failures. `go test ./internal/identity/keycloak/...` passes on this slice alone.
* Nothing is wired into the realm yet, so behavior does not change until #429.

## Decisions and problems

* The work is split into three stacked pull requests to stay near the 400-line limit, and each slice is built and tested alone.

## Next step

Review #428, the sign-up code step that creates the user.
