---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-30]
branch: feature/transaction-filters-sheet
tool: Claude Code
pr: "#235"
status: done
---

# The Filtros sheet of Movimientos

## Instruction

Same session as the M7 stack. Sofia chose to build the sheets the design exports closed "from components", listed in the PR as "new screen, needs design review".

## What was done

* `ui/FiltersSheet.tsx`, route `transactions.Filters` with the `sheet` transition:
  * Tipo (Todos, Ingresos, Gastos) as a segmented control.
  * Fecha: chips "Todas", "Este mes", "Mes anterior", "Últimos 3 meses", "Personalizado"; the custom range has "Desde" and "Hasta" fields typed as dd/mm/aaaa.
  * Monto: "Mínimo" and "Máximo" with the `$` prefix.
  * Cuentas and Categorías as chips.
  * "Limpiar", "Aplicar", the close button, and an error under the wrong field.
* `domain/filterDraft.ts`: what the sheet holds while editing and the filter it turns into; `domain/filter.ts` reads and writes dd/mm/aaaa.
* `ui/AllTransactionsScreen.tsx`:
  * Reads its filter from the route: the sheet's result, or `{ categoryId, from, to }` from Estadísticas.
  * Gets the "Filtros" button of the design (48 px, the design's filter icon) with a badge of the active filters.
* `ui/routes.ts`: route names in one file.
* Shared: the filter icon of the design (`M4 6h16M7 12h10M10 18h4`) in `shared/ui/icons/paths.ts`, in its own commit.
* Tests: draft to filter and back, wrong dates and amounts, and the sheet end to end: Gastos with "Mes anterior", amount with account and categories, opening again keeps the choices, errors, "Limpiar", and the filter of Estadísticas.

## Result

* Tests: 2207 of 2207 in the app. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the filter model.

## Decisions and problems

* The sheet layout, its copy and the badge on the button are not in the design (the export shows the sheet closed and the button with an empty slot). New screen, needs design review.
* There is no date picker library in the app, so the custom range is typed as dd/mm/aaaa. Adding a picker would be its own `chore/add-<library>` PR.
* The sheet returns the filter with `StackActions.popTo(..., { merge: true })`, so Movimientos keeps its place in the stack.
* `fitToContents` with a long scroll in a native form sheet must be checked on a phone.

## Next step

`feature/transaction-search-fts`: the FTS5 index, its triggers and the search field in the bar.
