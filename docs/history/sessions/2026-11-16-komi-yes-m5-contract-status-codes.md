---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M5
jira: [SCRUM-44]
branch: fix/bank-contract-declare-returned-status-codes
tool: Claude Code
pr: "#398"
status: done
---

# The bank contract declares the statuses the proxy already answers

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Juan Carlos's module, so Juan Carlos reviews it as CODEOWNER.

## What was done

* `contracts/modules/bank.yaml`: 400, 404, 422, 429 and 503 on the five bank operations, where each applies.
* Test: `services/api/internal/bank/contract_codes_test.go`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests). golangci-lint with `--build-tags integration` reports only the 6 issues that are already on `develop` (backup and migrate integration tests), none in this change.
* Pull request: #398.
* The generated server and the TypeScript types now carry those statuses.
* The test uses the response types the generator creates per declared status, so it does not compile with the old contract. I checked that.

## Decisions and problems

* A contract change was in scope this time: Daniel approved the list B.

## Next step

Juan Carlos reviews the pull request.
