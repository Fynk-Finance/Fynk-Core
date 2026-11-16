---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-8]
branch: fix/vault-lock-recovery-code-screen
tool: Claude Code
pr: "#413"
status: done
---

# The recovery code screen locks after 5 minutes in the background

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in my own module.

## What was done

* `apps/mobile/src/modules/vault/application/lockController.ts`: `recoveryCode` joins the states the background lock covers.
* Test: one in `lockController.test.ts`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,881 tests, Go and script tests).
* Pull request: #413.
* The code leaves the screen with the lock, and a new one is offered after the unlock.
* The test was run on the old controller and failed.

## Decisions and problems

* This is my own module, so the pull request has no code owner to ask. It needs an approval from a teammate.
* Not done, the other items of BUG-26. The recovery limiter needs a Redis to test and there is none here or in CI. The restore that ignores skipped records needs a decision on what to tell the person. The first-device rule and the reset order may be intended.

## Next step

A teammate approves the pull request.
