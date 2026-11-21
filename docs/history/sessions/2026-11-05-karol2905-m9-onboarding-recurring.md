---
date: 2026-11-05
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-54]
branch: feature/recurring-onboarding-setup
tool: Claude Code
pr: none
status: done
---

# "Gastos recurrentes" for onboarding step 5 (SCRUM-54)

## Instruction

"mientras me aprueban 273, se puede adelantar": the same as #273 (step 4) for onboarding step 5. `onboarding/ui/PlaceholderStep.tsx` (M3) says `TODO(M9) SCRUM-54 embed RecurringQuickList, RecurringForm and the Total mensual box`.

## What was done

* **`ui/RecurringFormFields.tsx`:** the fields of a fixed expense or subscription (name, type, category, amount, periodicity with day or weekdays, "¿Cuánto la usas?", Recordatorio), taken out of `RecurringFormScreen` without changing them. The screen uses it; its 8 tests pass.
* **`ui/RecurringSetup.tsx`:** the body of step 5 as in the design OnbGastos.
  * "Tus gastos recurrentes" with "4 gastos".
  * Collapsible cards (soft tile with the category icon, name, "Arriendo · día 5", amount, chevron); the open one has the fields, "Guardar gasto" and "Eliminar gasto".
  * The dashed "Agregar gasto recurrente".
  * The "Total mensual · Te avisaremos de 2 pagos" box on `surfaceBlue`.
  * With no items, a new card is open.
* **`index.ts`:**
  * `RecurringSetup`;
  * `getRecurringMonthlyTotal()`, the monthly total of the active items as Billetera counts it.
* **`RecurringCard`:** exports its category icon map (`CATEGORY_ICONS`), so both use the same icons.
* **Tests:** `ui/RecurringSetup.test.tsx` (4):
  * the design's four items with "4 gastos", "Te avisaremos de 2 pagos" and $1.453.900;
  * a new item saved and the total updated;
  * errors without saving;
  * edit and delete in dark theme.

## Result

* 218 suites and 2512 tests pass. ESLint, tsc and Prettier are clean.
* About 650 changed lines. About 170 of them only move the form fields, and the tests are about 140.

## Decisions and problems

* **App category names.** The cards use the shared category labels ("Arriendo"), where the design says "Vivienda". Needs design review.
* **"Guardar gasto" inside the open card,** for the same reason as in step 4: "Terminar configuración" belongs to M3.
* **One component for the step,** like `GoalsSetup`, instead of `RecurringQuickList` plus `RecurringForm`.

## Next step

Ask Sofia (M3) to replace both placeholders with `<GoalsSetup />` and `<RecurringSetup />`.
