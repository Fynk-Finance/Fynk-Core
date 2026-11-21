---
date: 2026-11-05
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-51]
branch: feature/savings-onboarding-goals
tool: Claude Code
pr: none
status: done
---

# "Crea tus metas" for onboarding step 4 (SCRUM-51)

## Instruction

Karol asked what was left after SCRUM-58 and said "si" to the first item. `onboarding/ui/PlaceholderStep.tsx` (M3) still says `TODO(M8) SCRUM-51 embed GoalForm and GoalCardCompact from @modules/savings`, and M8 did not export a component for that step.

## What was done

* **`ui/GoalFormFields.tsx`:** the goal fields (name, category, target, month picker, live "Aporte mensual sugerido") taken out of `GoalFormScreen` without changing them. The screen now uses it; its 7 tests still pass.
* **`ui/GoalsSetup.tsx`:** the body of step 4 as in the design OnbMetas.
  * Collapsible cards (lime goal tile, name, "Viaje · $5.000.000", chevron); the open one shows the fields, "Guardar meta" and "Eliminar meta".
  * The dashed "Agregar otra meta".
  * With no goals, a new card is already open.
  * The goals are saved in the vault like the ones from Metas.
* **`index.ts`:** exports `GoalsSetup`, for M3 to render inside its step frame above "Continuar".
* **Strings:** `setupStrings`, at the end of `strings.es-CO.ts`.
* **Tests:** `ui/GoalsSetup.test.tsx` (4):
  * the design's "8 meses para llegar a $5.000.000 · $625.000" and saving;
  * the errors without saving;
  * editing and deleting a saved goal;
  * "Agregar otra meta" in dark theme.

## Result

* 210 suites and 2446 tests pass. ESLint, tsc and Prettier are clean.
* The onboarding still shows its placeholder until M3 renders `<GoalsSetup />`. That is Sofia's file.

## Decisions and problems

* **One component for the whole step instead of `GoalForm` and `GoalCardCompact`.** The prompt names those two, but the step needs the list, the open card and "Agregar otra meta" together; one component is simpler for M3 to place. `GoalCardCompact` stays the Dashboard's carousel card.
* **An explicit "Guardar meta" in the open card.** The design shows none and relies on "Continuar", which belongs to M3. A save inside the card keeps the goal from being lost if the person changes card or skips. Needs design review.

## Next step

The same for M9: `RecurringSetup` (OnbGastos) and `getRecurringMonthlyTotal()`. Then ask Sofia to place both in onboarding.
