---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M5
jira: [SCRUM-23]
branch: fix/bank-reconnect-after-lost-refresh-answer
tool: Claude Code
pr: "#396"
status: done
---

# A link whose refresh token is dead ends on the phone instead of failing on every sync

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Juan Carlos's module, so Juan Carlos reviews it as CODEOWNER.

## What was done

* `apps/mobile/src/modules/bank/application/syncEngine.ts`: the two codes join the set of codes that end a link.
* Test: one `it.each` in `syncEngine.test.ts`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,880 tests, Go and script tests).
* Pull request: #396.
* The link ends once and `sync.failed` is emitted with the code.
* Both cases were run on the old engine and failed.

## Decisions and problems

* Both codes are permanent: one engine runs per phone, so a mismatch is never a race that heals.
* The backend consent is not revoked from the phone. That needs M4's revoke flow with the identity check.

## Next step

Juan Carlos reviews the pull request.
