---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M0
jira: [SCRUM-68]
branch: fix/shared-api-request-timeout
tool: Claude Code
pr: "#415"
status: done
---

# The API client ends a request the server never answers

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Sofia's module, so Sofia reviews it as CODEOWNER.

## What was done

* `apps/mobile/src/shared/api/client.ts`: `DEFAULT_TIMEOUT_MS`, `timeoutMs` and the abort in `send`.
* Test: one in `client.test.ts`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,879 tests, Go and script tests).
* Pull request: #415.
* A hanging request ends with `network_error`.
* The test was run on the old client and timed out.

## Decisions and problems

* 35 s, above the server's 30 s, so the client never cuts an answer the server is still writing.

## Next step

Sofia reviews the pull request.
