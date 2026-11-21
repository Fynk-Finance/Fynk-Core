---
date: 2026-11-03
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-52]
branch: feature/savings-link-movement
tool: Claude Code
pr: none
status: done
---

# "Vincular un movimiento": a synced movement counts as an aporte to a goal

## Instruction

Karol asked to review what was left that does not need Go: "Revisa lo que falte que no haga falta go". M7 now exports `setTransactionGoal` and `getTransactionsBetween`, so the last criterion of SCRUM-52 ("Asociar un movimiento sincronizado") could be done. Claude listed the work in order and Karol answered "Si, hazlo".

## What was done

* **`application/contributionService.ts`:** `linkableMovements()`, the picker of the M8 prompt. It lists the outflows of the last 60 days (`LINK_WINDOW_DAYS`) that are booked and not linked yet, newest first. It reads them through a new `listMovements` dependency.
* **`index.ts`:** wires M7: `movements: { setTransactionGoal }` and `listMovements: getTransactionsBetween`. It registers the route `savings.LinkMovement` (`metas/:goalId/vincular`) and turns on the button in Metas.
* **`ui/LinkMovementScreen.tsx`** (new screen, needs design review):
  * Lists the movements with their description, day in Bogotá and amount.
  * Tapping one counts it as an aporte and goes back to Metas.
  * A movement already linked is refused with a message.
  * Empty state, and the line "En Movimientos quedará como aporte a tu plan de ahorro. Fynk no mueve tu dinero."
* **`ui/GoalCard.tsx` and `ui/MetasScreen.tsx`:** "Vincular un movimiento" in the open card, shown when M7 is wired (`canLink`).
* **Tests:**
  * `contributionService.test.ts` (+3): the 60 day window and order; inflows, pending and linked movements left out; empty without M7.
  * `ui/LinkMovementScreen.test.tsx` (6).
  * `ui/MetasScreen.test.tsx` (+2).

## Result

* Tests: 190 suites and 2342 tests pass. ESLint, tsc and Prettier are clean.
* With this, every criterion of SCRUM-52 is covered: manual aporte with amount and day (#174, #177), linked movement (this pull request), Fynk never moves money, shown in Movimientos through M7's `goalId`, and undo.

## Decisions and problems

* **The picker lists all outflows**, whatever their category, because a contribution can be a transfer, a deposit or a cash withdrawal. Movements already linked, pending ones and inflows are left out.
* **Linking marks the movement in M7 before it counts.** If M7 refuses, the contribution is undone (#174).

## Next step

The data M10 asks for (`AnalyticsSources`: goals, payday contribution, subscriptions, fixed expenses).
