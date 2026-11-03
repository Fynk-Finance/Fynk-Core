---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-29, SCRUM-32]
branch: feature/manual-transaction-sheet
tool: Claude Code
pr: none
status: done
---

# The "Registrar movimiento" sheet, and Editar and Eliminar

## Instruction

Same session as the M7 stack. Nuevo movimiento manual of the prompt. Sofia chose "Follow the design": the entry is the Dashboard FAB "Registrar gasto o ingreso" (a sheet), not a "+" on the list. Sofia also chose to build the closed sheets "from components".

## What was done

* `ui/ManualTransactionSheet.tsx`, route `transactions.New` as a sheet (`{ id? }` to edit):
  * Gasto or Ingreso.
  * Monto with `$`.
  * Cuenta as chips: every account but CDTs, with Efectivo picked first.
  * Fecha: Hoy, Ayer or Otra (dd/mm/aaaa).
  * Descripción.
  * Categoría: "Automática" or a chosen one.
  * A note that it is a record and moves no money; "Guardar".
  * Errors under each field, and an empty state when there is no account or cash yet.
* `domain/manualDraft.ts`: the sheet's state and the input it turns into.
  * Today is saved at the current time. Another day is saved at noon in Bogotá, or keeps its time when an edit does not change the day.
  * Days in the future are refused.
* `ui/TransactionDetailScreen.tsx`: manual movements get "Editar" (opens the sheet) and "Eliminar" (asks "¿Eliminar este movimiento?" first).
* `index.ts` registers the route and exports `NEW_TRANSACTION_ROUTE` for the Dashboard FAB.
* Tests:
  * The draft rules.
  * A gasto in Efectivo categorized as Restaurantes; an ingreso in a bank account with a picked category.
  * Missing fields; no accounts.
  * Edit from the detail, keeping the time; delete after asking.

## Result

* Tests: 2327 of 2327 in the app. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the manual movements data.

## Decisions and problems

* The FAB CSS of the design hints at action pills before the sheet (`fb-act`, `fb-pill`). With only one action here (register a movement), the FAB will open the sheet directly. New screen, needs design review.
* The route has no deep link path: `movimientos/nuevo` would collide with `movimientos/:id`.
* Typed dates instead of a date picker, as in Filtros (no picker library in the app).

## Next step

`feature/dashboard-movements-and-fab`: the preview and the FAB on the Dashboard and the list in Detalle de cuenta (M6 files).
