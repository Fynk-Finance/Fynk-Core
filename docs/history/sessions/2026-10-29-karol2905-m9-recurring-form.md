---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-54]
branch: feature/recurring-form
tool: Claude Code
pr: none
status: done
---

# Form to add, edit and delete recurring items (second of three pull requests for SCRUM-54)

## Instruction

Same session as `feature/recurring-items-store` (#152): SCRUM-54 split in three pull requests, opened from Karol's account.

## What was done

* `ui/formState.ts`: the form as typed, how it becomes a `RecurringInput` (amount with `parseCopInput`, day from 1 to 31), filling it from an item to edit, and changing the periodicity (daily starts on Monday to Friday, weekly on one day).
* `ui/RecurringFormScreen.tsx`: route `recurring.Form` (`fynk://billetera/recurrentes/nuevo`). It is a new screen built from the onboarding card of the design (`OnbGastos`).
  * Fields: Nombre, Tipo (Gasto fijo or Suscripción), Categoría, Monto, Cada cuánto (Mensual, Semanal, Diario), then the charge day or the weekdays, and Recordatorio.
  * An error shows under each field. Editing opens with `{ id }`, and "Eliminar gasto" asks first.
* `ui/strings.es-CO.ts`: the module's copy.
* `index.ts`: the route and `RECURRING_FORM_ROUTE`.
* Tests: 5 for the form rules and 6 for the screen. They cover adding monthly and weekly items, field errors, editing, deleting after the confirmation, and the dark theme.

## Result

* Tests: 75 suites and 1009 tests of the app pass. ESLint, `tsc` and Prettier are clean.
* Pull request: opened from Karol's account, stacked on #152.

## Decisions and problems

* The form offers only the periodicities of HU-038 (mensual, semanal, diaria). Biweekly and yearly items come from detection.
* With @testing-library/react-native 14, `fireEvent` is asynchronous and must be awaited, or the state never updates in the test.

## Next step

The Billetera section ("Gastos recurrentes", "Gastos fijos de este mes", "+ Agregar").
