---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-51]
branch: feature/savings-goal-form
tool: Claude Code
pr: none
status: done
---

# Goal form with the live suggested monthly amount

## Instruction

After #169 (savings goals in the vault) was opened, Claude proposed the goal form and the Metas screen stacked on it, and Karol answered "si".

## What was done

* **`savings/ui/goalFormState.ts`:**
  * The typed form becomes a `GoalInput`: the amount goes through `parseCopInput`, plus the field errors.
  * An old goal may keep a deadline that already passed.
  * A new goal starts 6 months ahead.
  * `addMonths` for the month stepper.
  * `suggestionPreview` for the live box; when editing, it counts what the goal already saved.
* **`savings/ui/GoalFormScreen.tsx` (route `savings.GoalForm`, path `metas/nueva`, params `{ id }` to edit):** the fields of OnbMetas.
  * Nombre de la meta.
  * Categoría as chips.
  * Monto objetivo.
  * Fecha límite: "Jun 2027" between two chevrons, never before the current month.
  * The lime "Aporte mensual sugerido · 8 meses para llegar a $5.000.000 · $625.000" box, using the `accentSurface` and `accentText` tokens.
  * Guardar meta, and Eliminar meta with a confirmation that says the money does not move.
* **`savings/ui/strings.es-CO.ts`:** the form copy, the category names and `monthLabel`.
* **`index.ts`:** registers the route and exports `GOAL_FORM_ROUTE`, so M3 (onboarding step 4) and Metas can push it.
* **Tests:**
  * `ui/goalFormState.test.ts` (8): input in centavos, errors, kept deadline, the start 6 months ahead, months across years, "Jun 2027", the preview with $625.000, saved amount when editing, no preview without an amount.
  * `ui/GoalFormScreen.test.tsx` (7): creating the OnbMetas goal with the live box, errors, the stepper stops at the current month, the empty box, editing, deleting after the confirmation, dark theme.

## Result

* Tests: 83 suites and 1078 tests pass. ESLint, tsc and Prettier are clean.
* Pull request: stacked on #169.

## Decisions and problems

* **The deadline uses a month stepper,** not a text field. The design shows "Jun 2027" in a field; the stepper cannot produce an invalid month, and it never goes before the current month.
* **The category is a row of chips,** like the recurring form. The design has a dropdown; React Native has no native one that works the same in both themes.
* **As a full screen the form is new and needs design review.** The design has it only inside the onboarding card (OnbMetas) and in the Metas "Nueva meta" sheet, which is not drawn.
* **Icons:** goal for the name and piggy for the amount, from the shared icon set.

## Next step

The Metas screen (header, stats, "Próximas metas" with collapsible cards, "Nueva meta" FAB) and the Dashboard carousel.
