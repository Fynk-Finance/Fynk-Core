---
date: 2026-10-28
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-51, SCRUM-53]
branch: feature/savings-goal-domain
tool: Claude Code
pr: none
status: done
---

# Savings goal rules (M8 domain, step 1 of the work plan)

## Instruction

With the M9 domain pull requests open, Karol agreed to the next proposal, the pure rules of M8: "si, sigue".

## What was done

* `modules/savings/domain/goals.ts`:
  * `monthsLeft(today, deadline)`: months after the current one up to the deadline month, at least 1.
  * `suggestedMonthly`: the missing amount over the months left, rounded up to the next $1.000.
  * `progressPercent`: integer percent, never above 100, and 100 only when complete.
  * `remaining`: never negative.
  * `pace`: "Vas a tiempo", or "Te faltan $X al mes", from the average of the last 3 months or of the months since creation.
  * `reachedMilestones`: 50, 75 and 100 with the dedupe key `goal:<id>:<milestone>`.
  * `goalsMonthlyTotal` and `shareOfIncome`.
* `goals.test.ts`: 21 tests with every reference number of the shared contracts and the M8 prompt. They cover 8 months, $625.000, $215.000, 64 %, the Metas goal ("Faltan 2 meses", $140.000/mes, "Te falta $280.000", 65 %), "2 metas $840.000/mes", 23 % of income, and milestones that fire once for progress 49, 51, 49, 51.

## Result

* Tests: 21 pass. ESLint, `tsc` and Prettier are clean.
* Pull request: not opened yet.

## Decisions and problems

* The percent is rounded down, so the goal never reads "100 %" before it is complete.
* "Te faltan $X al mes" is rounded up to the next $1.000, like the suggested amount, so both numbers on the screen add up.
* The milestone dedupe works through M12: the same key is shown once (tested in M12).
* The notification copy ("Llegaste al 75 % de tu meta.") goes in `ui/strings.es-CO.ts` with the next branch, not in the domain.

## Next step

Open the pull request. `feature/savings-goal-creation` (tables, GoalForm, list, carousel) waits for M2's vault in `develop`.
