---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-30]
branch: feature/transaction-filters
tool: Claude Code
pr: none
status: done
---

# Filters of Movimientos: the model and its SQL

## Instruction

Same session as the M7 stack. Work plan step 2, split in two: this branch is the filter model and its queries, the next one is the Filtros sheet. HU-016: "Filtros por fecha, monto, cuenta y categoría".

## What was done

* `domain/query.ts`: `TransactionFilter` gains `kind` (Ingresos or Gastos), `minAmountMinor` and `maxAmountMinor` (without sign, both included) and `categoryIds`.
* `adapters/vault/vaultTransactionsStore.ts`: the WHERE clause for them, shared by the keyset pages, the full lists and the summary.
* `domain/filter.ts`:
  * `presetRange` for "Este mes", "Mes anterior" and "Últimos 3 meses" on Bogotá days, and `presetOf`.
  * `filterProblems`: a range that ends before it starts, negative or broken amounts, a minimum above the maximum.
  * `activeFilterCount`, for the badge on "Filtros".
  * `filterFromParams`, for the `{ categoryId, from, to }` that Estadísticas (M10) already sends and an `{ accountId }`.
* Tests: presets at month and year edges and on the Bogotá day; each filter alone and all combined on the node:sqlite vault, with the summary following the filter.

## Result

* Tests: 50 of 50 in the module. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the preview.

## Decisions and problems

* "Últimos 3 meses" is the 3 months that end today (23 jun to 22 sep), not 3 calendar months.
* Amount filters compare the amount without sign, so "más de $100.000" finds both a big income and a big expense. "Ingresos" and "Gastos" pick the sign.
* Todos, Ingresos and Gastos live in the filter (and later in the sheet), not as chips over the list, because the design has no chips.

## Next step

`feature/transaction-filters-sheet`: the Filtros sheet, the badge on its button, and Movimientos opening with the filter of M10's params.
