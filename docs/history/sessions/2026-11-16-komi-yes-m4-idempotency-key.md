---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M4
jira: [SCRUM-20]
branch: fix/consents-keep-idempotency-key-on-retry
tool: Claude Code
pr: "#397"
status: done
---

# The consent Idempotency-Key lives for the app run, not for one screen

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Juan Carlos's module, so Juan Carlos reviews it as CODEOWNER.

## What was done

* `apps/mobile/src/modules/consents/application/createConsent.ts`: the key map and the check of the returned status.
* Tests: two in `createConsent.test.tsx`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,880 tests, Go and script tests).
* Pull request: #397.
* One pending consent per entity and text version in an app run.
* Both tests were run on the old hook and failed.

## Decisions and problems

* The map is keyed by the deps object, so each test with its own deps starts empty.

## Next step

Juan Carlos reviews the pull request.
