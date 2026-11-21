---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-64]
branch: fix/bank-simulator-stable-movements-cursor
tool: Claude Code
pr: "#401"
status: done
---

# The simulator pages movements by the last movement, not by position

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Juan Pablo's module, so Juan Pablo reviews it as CODEOWNER.

## What was done

* `services/bank-simulator/internal/store/store.go`: the cursor in `GetTransactions`.
* Test: one in `store_test.go`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests). golangci-lint with `--build-tags integration` reports 0 issues in `services/bank-simulator`.
* Pull request: #401.
* The second page starts right after the last movement of the first, whatever the portal adds in between.
* The test was run on the code of #392 and failed: the second page repeated a movement.

## Decisions and problems

* An unknown cursor restarts instead of failing: Fynk upserts movements by id, so a repeated page does no harm.

## Next step

Juan Pablo reviews the pull request.
