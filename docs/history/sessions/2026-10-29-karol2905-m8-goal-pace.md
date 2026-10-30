---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-53]
branch: feature/savings-goal-pace
tool: Claude Code
pr: none
status: done
---

# "Vas a tiempo" or "Te faltan $X al mes para llegar" on each goal

## Instruction

With #177 merged, Karol said "listo ya mezcle 177, sigue". The open item of SCRUM-53 (HU-037 Seguimiento) was "Indica si el ritmo permite cumplir".

## What was done

* **`domain/goal.ts`:**
  * `summarizeGoal` now takes the goal's recent contributions and adds `pace`, using `pace()` from `goals.ts` (the 28 Oct rule: the average of the last 3 months, or of the months since creation, against the suggested amount).
  * It also adds `started` (whether the goal has any aporte).
  * The creation day is taken in Bogotá.
* **`application/goalService.ts`:** `list` reads the contributions since the first day of two months ago (`paceWindowStart`) and gives each goal its own.
* **`adapters/vault/vaultGoalStore.ts` and `application/ports.ts`:** `contributionsSince(from)`.
* **`ui/GoalCard.tsx`:** a line in the open card.
  * "Vas a tiempo" with a green check.
  * "Te faltan $X al mes para llegar" with a red warning.
  * For a goal with no aporte yet, a neutral "Abona $X al mes para llegar a tiempo", so a goal created today is not warned.
* **Tests:**
  * `application/goalService.test.ts` (+5): on track, behind by $150.000, only the last 3 months count, a reached goal is done, `paceWindowStart` across the year.
  * `ui/MetasScreen.test.tsx` (+3): the three lines.

## Result

* Tests: 110 suites and 1341 tests pass. ESLint, tsc and Prettier are clean.
* Pull request: opened from Karol's account against `develop`.

## Decisions and problems

* **The pace line goes in the open card of Metas,** because the "Detalle de meta" screen of the M8 prompt does not exist yet. It is new copy and needs design review.
* **A goal with no aporte gets a neutral nudge, not a warning.** The rule would say "behind" from the first day.

## Next step

SCRUM-53 is complete with #175. Next: "Detalle de suscripción" (SCRUM-58 without the catalog): usage, reminder, "Ya la cancelé" and "No es una suscripción".
