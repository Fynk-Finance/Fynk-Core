---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-29]
branch: feature/dashboard-movements-and-fab
tool: Claude Code
pr: "#242"
status: done
---

# M7's movements on the Dashboard and in Detalle de cuenta, top of the M7 stack

## Instruction

Same session as the M7 stack: "a last branch wiring TransactionPreview and the FAB into your M6 Dashboard and TransactionList into Detalle de cuenta". M6 is Sofia's module too.

## What was done

* `accounts/ui/DashboardScreen.tsx`:
  * Renders "Movimientos" under the balance card (`renderMovements`, M7's `TransactionPreview`).
  * Adds the FAB "Registrar gasto o ingreso" of the design (shared `Fab`, right 16, bottom 92), which opens M7's sheet (`newMovementRoute`).
* `accounts/index.ts`:
  * Passes `TransactionPreview` and `NEW_TRANSACTION_ROUTE` to the Dashboard.
  * Passes `TransactionList` filtered by the account to Detalle de cuenta (`renderTransactions`, the slot left in M6 branch 3).
* `accounts/ui/strings.es-CO.ts`: the FAB's label.
* Tests: the Dashboard shows the movements and the FAB opens the sheet route; no FAB when M7 gives no route.

## Result

* Tests: 2329 of 2329 in the app, including the shell test that loads every module. Lint, typecheck and Prettier clean.
* Pull request: top of the M7 stack.

## Decisions and problems

* M6 and M7 import each other (M7 reads `useAccounts`). Both pass the other module's values as functions that run at render time, so the import order never matters.
* Ingresos and Gastos of the balance card still show $0. The `TODO(M10)` stays: they should come from M10's `useMonthSummary()` (which reads M7's movements) once the app configures M10.
* Pull to refresh on the Dashboard is still `TODO(M5)`.

## Next step

Sofia reviews the stack and the screens on a phone in light and dark. The other owners wire M7 into their modules:
* M5: `upsertFromSync` into the sync engine.
* M8: `setTransactionGoal`.
* App startup: `configureAnalytics` with `getTransactionsBetween`.
* M9: `getCatalogCategory`.

Then the Gate C search check on a mid-range Android phone.
