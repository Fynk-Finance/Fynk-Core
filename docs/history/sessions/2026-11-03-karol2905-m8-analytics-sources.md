---
date: 2026-11-03
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-53]
branch: feature/savings-analytics-sources
tool: Claude Code
pr: none
status: done
---

# What M10 reads from the goals: snapshot goals and the payday aporte

## Instruction

Second item of the list Karol approved ("Si, hazlo"): M10's `configureAnalytics` asks M8 for `getGoalSummaries` and `getPaydayContribution` (`AnalyticsSources`).

## What was done

* **`domain/analytics.ts`:**
  * `goalForAnalytics`: a goal in the shape of the snapshot (shared contracts 3.5), with a movement category (`education` for Educación, `savings` for the rest) and `onTrack` from the pace of #178.
  * `paydayFor`: the next multiple of $100.000 above the suggested monthly amount, and how many months earlier it reaches the goal. Viaje a Cartagena gives $300.000 and 2 months, as in the Recomendaciones design.
  * `paydayContribution`: the goal with the nearest deadline that it shortens.
* **`index.ts`:**
  * `getGoalsForSnapshot()`: goals not reached yet.
  * `getPaydayContribution()`.
  * Both are typed with M10's own `GoalSummary` and `PaydayContribution` types (type-only import).
* **Tests:** `domain/analytics.test.ts` (5): $300.000 and 2 months, no suggestion when it does not shorten the goal, none for a reached goal, nearest goal first, the snapshot fields.

## Result

* Tests: 190 suites and 2336 tests pass. ESLint, tsc and Prettier are clean.
* M9 already exports what M10 asks: `getSubscriptionsSummary()` and `getFixedExpensesThisMonth()`.
* Nothing in the app calls `configureAnalytics` yet. Whoever installs it (M10 or M0) passes:
  `getGoalSummaries: getGoalsForSnapshot`, `getPaydayContribution`,
  `getSubscriptionSummary: getSubscriptionsSummary`, `getFixedExpensesMonthly: getFixedExpensesThisMonth`.

## Decisions and problems

* **The payday amount rounds up to the next $100.000** so the card shows a round number that shortens the goal. That is the rule that gives the design's numbers; the M8 prompt does not fix one.
* **A goal with no aporte yet counts as not on track** for the snapshot, which is what the pace rule says.

## Next step

"Programar" in Recomendaciones: the payday reminder of the M8 prompt ("Hoy es día de pago: aparta $300.000 para Viaje a Cartagena"). Then the encrypted backup of goals and recurring items.
