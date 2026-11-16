---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M10
jira: [SCRUM-60]
branch: fix/analytics-keep-cap-alerts-while-notices-are-off
tool: Claude Code
pr: "#408"
status: done
---

# A cap alert that was silenced is not recorded as sent

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Julián's module, so Julián reviews it as CODEOWNER.

## What was done

* `apps/mobile/src/modules/analytics/application/analyticsService.ts`: silenced alerts are left out of `recordAlerts`.
* Test: one in `analyticsService.test.ts`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,879 tests, Go and script tests).
* Pull request: #408.
* An alert shows once, when its kind is on.
* The test was run on the old code and failed.

## Decisions and problems

* The alert is evaluated on sync, movement changes and unlock, so it shows at the next of those, not at the moment of the switch.
* Not done: editing a cap in the same period silences its new alerts. The analysis marks that as a team decision.
* A correction to the analysis report: it said a goal over $1.000 millones rejects the whole snapshot. The goal form has the same limit (`GOAL_TARGET_MAX`), so the phone cannot send one.

## Next step

Julián reviews the pull request.
