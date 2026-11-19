---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M16
jira: [SCRUM-65]
branch: fix/bank-simulator-card-overpayment
tool: Claude Code
pr: "#399"
status: done
---

# The simulator refuses a card payment bigger than the debt

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Juan Pablo's module, so Juan Pablo reviews it as CODEOWNER.

## What was done

* `services/bank-simulator/internal/store/store.go`: `ErrMoreThanDebt` and the check in `PayCard`.
* Test: one in `portal_actions_test.go`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests). golangci-lint with `--build-tags integration` reports 0 issues in `services/bank-simulator`.
* Pull request: #399.
* Paying the whole debt leaves the card at $0. One centavo more is refused.
* The test was run on the code of #391 and failed.

## Decisions and problems

* The portal shows the store's error text, as it does for the other refusals.
* A correction to the analysis report: it said that advancing time charges subscriptions without a funds check. `AdvanceTime` only moves the clock, so there was nothing to fix.

## Next step

Juan Pablo reviews the pull request.
