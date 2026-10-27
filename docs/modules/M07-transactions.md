# M7 Transactions

| Item | Value |
| --- | --- |
| Phase | 2 |
| Stories | HU-015 SCRUM-29 (3), HU-016 SCRUM-30 (3), HU-017 SCRUM-31 (2), HU-018 SCRUM-32 (5) |
| Points | 13 |
| Owner | Sofia Nicolle Ariza (`@sofia-ariza-783`) |
| Owns | `apps/mobile/src/modules/transactions/` |
| Depends on | M2 (vault, FTS5), M5 (movements written by sync), M9 (merchant catalog categories, optional at first) |
| Used by | M6, M8, M9, M10 |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M7 Transactions of Fynk: the movement list, filters, search, categories and manual movements. All of it runs on the phone over the vault. There is no backend in this module.

## Read first

1. `CLAUDE.md`, `docs/modules/00-shared-contracts.md` sections 2, 3.1 to 3.3.
2. Design PNGs `05-dashboard.png` (Movimientos preview) and `10-recomendaciones.png` and `10-recomendaciones-2.png` (chips used for filters). Read the code of the same screens in `docs/design/source/` first (file map in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs are for checking the result.
3. Jira SCRUM-29 to SCRUM-32.

## Stories and criteria

* **HU-015 (SCRUM-29)** Fecha, monto y descripción. Paginación. Orden cronológico. Información sincronizada.
* **HU-016 (SCRUM-30)** Filtros por fecha, monto, cuenta y categoría.
* **HU-017 (SCRUM-31)** Coincidencias parciales, respuesta rápida, sin distinguir mayúsculas y minúsculas, resultados relevantes.
* **HU-018 (SCRUM-32)** Categorías predeterminadas. Modificación manual. Historial de cambios. Actualiza reportes asociados.

## Screens

* **Movimientos preview** (`TransactionPreview`, used on the Dashboard): title "Movimientos", link "Ver todo", 3 latest rows: icon tile by category, title (merchant or description), subtitle "<cuenta> · <fecha corta>" like "Cuenta de ahorros · 22 sep", amount signed (`+$5.200.000` in blue, `-$184.300` in dark).
* **Todos los movimientos** (new, from "Ver todo"): search bar at the top, chips for quick filters (Todos, Ingresos, Gastos, and the top 4 categories), a filter sheet (date range presets "Este mes", "Mes anterior", "Últimos 3 meses" or custom, amount min and max, accounts, categories), list grouped by day with sticky day headers ("Hoy", "Ayer", "Lunes 20 sep"), infinite scroll of 50 rows, pull to refresh calls M5 `syncNow()`.
* **Detalle de movimiento** (new): amount, date and time, account, description, merchant, category with "Cambiar categoría", history of category changes ("Cambiaste de Otros a Restaurantes el 21 sep"), and for manual movements edit and delete.
* **Nuevo movimiento manual** (new, button "+" on the list): amount, ingreso or gasto, account (including Efectivo), date, description, category.

## Technical design

Vault tables through `registerVaultMigrations('transactions', ...)`:

```sql
create table transactions_transactions (
  id text primary key, account_id text not null, provider_tx_id text, source text not null,
  booked_at text not null, amount_minor integer not null, description text not null,
  merchant_raw text, merchant_key text, category_id text not null, category_source text not null,
  status text not null, goal_id text,
  unique (account_id, provider_tx_id)
)
create index tx_booked_idx on transactions_transactions (booked_at desc)
create virtual table transactions_fts using fts5 (description, merchant_raw, content='transactions_transactions', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2')
create table transactions_category_changes (
  id text primary key, transaction_id text not null, from_category text not null,
  to_category text not null, changed_at text not null
)
create table transactions_category_overrides (
  merchant_key text primary key, category_id text not null, updated_at text not null
)
```

* Keyset pagination on `(booked_at, id)`, never `OFFSET`.
* Search: FTS5 prefix query of each word (`super*`), case and accent insensitive through `remove_diacritics`. Target under 300 ms on 12 months (about 3.000 rows).
* Categorization pipeline (pure functions in `domain/categorize.ts`), first match wins:
  1. User override for the `merchantKey` (`transactions_category_overrides`).
  2. Merchant catalog category from M9 `getCatalogCategory(merchantKey)` when available.
  3. Keyword rules in `domain/rules.es-CO.ts` (for example `exito|d1|ara|olimpica` gives `groceries`, `uber|didi|transmilenio|sitp|cabify` gives `transport`, `netflix|spotify|disney|youtube|icloud` gives `subscriptions`, `arriendo` gives `rent`, `epm|codensa|enel|vanti|acueducto` gives `utilities`, `claro|movistar|tigo|wom|etb` gives `telecom`, `nomina|salario` on positive amounts gives `salary`).
  4. Purchases under the user's "Antojos" threshold (from M10 settings, default $20.000) in food categories go to `treats`.
  5. `other`.
* Changing a category asks "¿Aplicar a todos los movimientos de <comercio>?". Yes creates an override and recategorizes past movements of that merchant. Each change is stored in `transactions_category_changes`, then emits `transactions.changed`.
* Run categorization on `sync.completed` for the new ids only.
* Backup collections: `transactions.manual` (manual movements) and `transactions.category_overrides`. Category changes on bank movements are stored as overrides by `providerTxId` inside the same collection.
* Exports in `index.ts`: `TransactionPreview`, `TransactionList` (props: filter), `AllTransactionsScreen`, `TransactionDetailScreen`, `queryTransactions(filter, page)`, `getTransactionsBetween(from, to)` (used by M9 and M10), `setTransactionGoal(id, goalId)` (used by M8), `addManualTransaction(input)`, `searchTransactions(text)`.

## Work plan (one branch each, from `develop`)

1. `feature/transactions-store-and-pagination`: tables, keyset pagination, preview and full list.
2. `feature/transaction-filters`: filter sheet and chips.
3. `feature/transaction-search-fts`: FTS5 index, triggers to keep it in sync, search bar.
4. `feature/transaction-categorization`: pipeline, overrides, change history, detail screen.
5. `feature/manual-transactions`: create, edit, delete, backup collection.

## Tests

* Categorization table tests in Spanish, at least 40 merchant strings from the demo fixture.
* Search "SUPERMERC" and "supermércado" both find "Supermercado".
* Pagination never repeats or skips a row when new movements arrive in between.
* A recategorization emits `transactions.changed` and M10's monthly category totals change accordingly (integration test with M10 stub).

## Done when

* All criteria pass and the Gate C search item passes on a mid range Android phone.

## Ask before

* Sending any movement text off the phone, or adding machine learning categorization.
