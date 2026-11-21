---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M8
jira: [SCRUM-53]
branch: fix/savings-payday-reminders-and-undo-order
tool: Claude Code
pr: "#407"
status: done
---

# Savings: no old milestone notices after a restore, payday reminders come back, undo frees the movement first

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Karol's module, so Karol reviews it as CODEOWNER.

## What was done

* `index.ts`: the quiet first check after a restore, and the settings listener for the payday reminders.
* `application/milestoneNotifier.ts`: `catchUp`.
* `application/contributionService.ts`: the order in `undo`.
* Tests: `index.test.ts` (new) and one in `contributionService.test.ts`.

## Result

* Tests: `make lint` clean, `make test` passes (248 Jest suites, 2,881 tests, Go and script tests).
* Pull request: #407.
* A restore is silent about old milestones, and the reminders follow the settings at once.
* The three tests were run on the old code and failed.

## Decisions and problems

* A restored milestone is recorded without a notice, also on a phone that already had the goal: it was noticed on the phone where it happened.
* Two commits: the undo order (SCRUM-52) and the rest (SCRUM-53).
* Not done: payday reminders are not in the backup. It needs a new backup collection, which is not in the list of the shared contracts (3.2), so the team has to agree.
* Not done: the amount in the body of the phone's notification, and the "daily" proposal after three charges on consecutive days. The second follows the M9 prompt (3 charges, median 1 to 3 days). Both are product decisions.

## Next step

Karol reviews the pull request and takes the backup of the payday reminders to the team.
