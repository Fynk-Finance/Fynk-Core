---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-51]
branch: feature/savings-goals-carousel
tool: Claude Code
pr: none
status: done
---

# "Planes de ahorro" carousel for the Dashboard

## Instruction

While #174 waited for approval, Karol asked: "revisa que puedes avanzar con lo que esta ya mezclado y ve avanzando". SCRUM-51 asks for goals "desde el Dashboard"; the M8 prompt exports `GoalsCarousel` and `GoalCardCompact` for it.

## What was done

* **`ui/GoalsCarousel.tsx`:** "Planes de ahorro · Ver todos" and a horizontal carousel with snap, as in the Dashboard design.
  * Each 206 × 112 card has the lime 32 px tile with the category icon, the name, a 6 px bar, the saved amount, the percent in green, and the faint lime square in the corner.
  * Only goals not reached yet.
  * "Ver todos" and each card open Metas.
  * Without goals, a card "Crea tu primera meta" opens the form (new copy, needs review).
* **`index.ts`:** exports `GoalsCarousel` (bound to the goal service, it navigates by itself) and `GoalCardCompact`. Sofia's Dashboard (M6) renders `<GoalsCarousel />`.
* **Tests:** `ui/GoalsCarousel.test.tsx` (6): the design's card ($3.200.000 · 64%), reached goals left out, "Ver todos", a card, the empty card, dark theme.

## Result

* Tests: 108 suites pass (1307 tests). ESLint, tsc and Prettier are clean.
* Merged locally with #174 and the milestones branch: no conflicts, 107 savings tests and tsc pass together. The export sits at the end of `index.ts` so it does not touch the lines the milestones branch adds.
* Pull request: opened from Karol's account against `develop`.

## Decisions and problems

* **The card border is the lime at 30 % in the design; the closest token is `accentSoft`.**
* **A card opens Metas,** not a goal detail: the M8 prompt's "Detalle de meta" screen does not exist yet.

## Next step

"Vas a tiempo / Te faltan $X al mes" on the Metas card (SCRUM-53), and "Abonar" once #174 is merged.
