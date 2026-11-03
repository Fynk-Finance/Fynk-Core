---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-29]
branch: feature/transactions-list-screen
tool: Claude Code
pr: none
status: done
---

# The Movimientos screen with "Cargar 20 más" and pull to refresh

## Instruction

Same session as the M7 stack: "Follow the design" for Movimientos, so the list pages with "Cargar 20 más", shows the summary line and the design's day headers, and has no chips row and no "+" button.

## What was done

* `ui/AllTransactionsScreen.tsx`: the Movimientos screen of the design (inventory row 13), pushed with the default transition. Title "Movimientos" with the 48 px back button on the right, the bar with "Mostrando N de M · +$… · −$…", days with their net ("Hoy · 22 sep", "Ayer · 21 sep", "dom 20 sep", lime when positive), rows newest first, "Cargar 20 más", pull to refresh that calls M5's `syncNow()`, loading, error and empty states.
* `ui/TransactionRow.tsx`: the `.row` of the design: 40 px tile (light blue for money out, lime with the down arrow for money in), title, "<categoría> · <cuenta>" and the signed amount, a divider between rows of a day.
* `domain/dayGroups.ts`, `ui/labels.ts`, `ui/categoryIcons.ts`, `ui/strings.es-CO.ts`.
* `application/useTransactions.ts`: TanStack Query hooks (`useInfiniteQuery` on keyset pages, summary), refetched on `transactions.changed`, `sync.completed` and when the vault locks or opens.
* Store and service: `summarize(filter)` (count, money in, money out).
* Tests: day grouping across midnight in Bogotá, the screen with real data on the node:sqlite vault (rows, headers, summary, 45 rows paged by 20, pull to refresh, refresh after another module's change, dark colors).

## Result

* Tests: 2174 of 2174 in the app. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the store.
* Search and Filtros come in their own branches. Rows open nothing yet (the detail screen comes later).

## Decisions and problems

* The design wins over the prompt: pages of 20 with "Cargar 20 más" instead of infinite scroll of 50, and the design's day headers. Day headers do not stick, as in the design (only the bar does).
* The subtitle shows the shared category labels ("Mercado", "Salario"). The design's sample uses a few other words ("Comida", "Ingreso", "Ropa"), which are not in the shared categories.
* M7 takes the entity of an account ("Bancolombia" from "Bancolombia · Ahorros", "Efectivo" for cash) on its own instead of a new M6 export.
* `index.ts` uses `useAccounts` (M6) and `syncNow` (M5) only inside functions, because M5 and M6 will import M7 too.
* Pull to refresh needs M5 to wire the sync engine; until then `syncNow()` answers "unavailable" and the list just reloads from the vault.
* The list is virtualized, so the paging test checks the summary line, not rows far down.

## Next step

`feature/transaction-preview-and-account-list`: the Dashboard preview and the list of Detalle de cuenta.
