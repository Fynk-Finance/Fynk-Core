---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-32]
branch: feature/transaction-detail-screen
tool: Claude Code
pr: "#239"
status: done
---

# Detalle de movimiento and "Cambiar categoría"

## Instruction

Same session as the M7 stack. The prompt's Detalle de movimiento: "amount, date and time, account, description, merchant, category with Cambiar categoría, history of category changes (Cambiaste de Otros a Restaurantes el 21 sep)". Edit and delete of manual movements come in the next branch.

## What was done

* `ui/TransactionDetailScreen.tsx`, route `transactions.Detail` (`movimientos/:id`), pushed:
  * The amount (34 px) with its tile, title, and date and time in Bogotá ("lunes 21 sep 2026 · 9:03 a. m.").
  * Cuenta ("Bancolombia · Cuenta de ahorros"), Descripción, Comercio, Estado, and the category with "Cambiar categoría".
  * "Historial de cambios".
  * Loading, error, and "Este movimiento ya no está".
* `ui/CategoryPickerSheet.tsx`, route `transactions.Category` as a sheet:
  * Every category with its icon, the current one marked "Actual".
  * When the movement has a merchant, the question "¿Aplicar a todos los movimientos de <comercio>?" with "Solo este" and "Aplicar a todos".
* Rows of Movimientos, the Dashboard preview and Detalle de cuenta open the detail.
* `application/useTransactions.ts`: `useTransaction(id)` and `useCategoryHistory(id)`, refreshed on `transactions.changed`.
* `ui/labels.ts`: `dateTimeLabel`, `historyLine`, `accountLabel`.
* Tests: opening from a row and its data; "Solo este" with the history line; "Aplicar a todos" changing the other movement of the merchant; a deleted movement; the 12 hour time in Bogotá.

## Result

* Tests: 2305 of 2305 in the app. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the category changes.

## Decisions and problems

* Both screens are new: the design has no movement detail (README, "Screens the design does not have yet"). They need design review.
* The question uses the system dialog (`Alert.alert`), because there is no shared dialog component. The design's CSS has a `cf-dlg` animation that may be that dialog, but it is exported closed.
* The back button sits on the right, as on Movimientos.

## Next step

`feature/manual-transactions`: create, edit and delete manual movements, and the `transactions.manual` backup.
