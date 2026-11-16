---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M11
jira: [SCRUM-38]
branch: fix/recommendations-check-plain-amounts
tool: Claude Code
pr: "#409"
status: done
---

# The post check also reads amounts the model writes without the peso sign

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Julián's module, so Julián reviews it as CODEOWNER.

## What was done

* `services/api/internal/recommendations/advisor/checks.go`: `plainAmountPattern` and `plainAmount`.
* Tests: four golden cases and one new test in `advisor_test.go`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,878 tests, Go and script tests). golangci-lint with `--build-tags integration` reports only the 6 issues that are already on `develop` (backup and migrate integration tests), none in this change.
* Pull request: #409.
* An invented amount is rejected in the four forms, and the design fixture's good answer still passes.
* The four new bad outputs passed the old check on every fixture.

## Decisions and problems

* Amounts already checked with `$` and percents are taken out of the text before the second pass, so nothing is checked twice.

## Next step

Julián reviews the pull request.
