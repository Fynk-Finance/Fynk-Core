# M10 Analytics engine and spending caps

| Item | Value |
| --- | --- |
| Phase | 3 |
| Stories | HU-021 SCRUM-35 (5), HU-022 SCRUM-36 (5), HU-023 SCRUM-37 (8), HU-043 SCRUM-60 (5) |
| Points | 23 |
| Owner | Julián Castiblanco (`@JulCR34l`) |
| Owns | `apps/mobile/src/modules/analytics/` |
| Depends on | M7 (movements), M8 and M9 (their summaries), M12 (cap alerts) |
| Used by | M6 (Ingresos and Gastos), M11 (the snapshot), Recomendaciones |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M10 of Fynk: every deterministic calculation that the screens and the AI use, the charts for spending, and the spending caps. Architecture rule 5 is yours: code calculates, the LLM only writes. Every number shown anywhere in Recomendaciones must come from a function in this module, with a test.

## Read first

1. `CLAUDE.md`, `docs/modules/00-shared-contracts.md` sections 2, 3.4, 3.5 and 7.
2. Design PNGs `05-dashboard.png`, `10-recomendaciones.png` and `10-recomendaciones-2.png` (donut and steps), `11-inversion.png` and `11-inversion-2.png` (line chart style), `16-config-metas.png` and `16-config-metas-2.png` (form style for caps). Read the code of the same screens in `docs/design/source/` first (file map in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs are for checking the result.
3. Jira SCRUM-35, SCRUM-36, SCRUM-37, SCRUM-60.

## Stories and criteria

* **HU-021 Distribución de gastos (SCRUM-35)** Gráficos claros, información actualizada, selección de períodos, cálculos correctos.
* **HU-022 Tendencias (SCRUM-36)** Comparaciones temporales, rangos de fechas, información comprensible, datos consolidados.
* **HU-023 Ingresos recurrentes (SCRUM-37)** Patrones repetitivos, montos estimados, fuentes de ingreso, cálculos verificables.
* **HU-043 Topes por categoría (SCRUM-60)** Crear, editar y eliminar tope semanal o mensual por categoría. "Antojos" agrupa compras por debajo de un monto definido por el usuario, $20.000 por defecto. Gasto acumulado contra el tope. Avisos al 80 % y al 100 %. Avisos al abrir o actualizar la aplicación. Se crea desde "Fijar tope" en Recomendaciones. Bóveda cifrada y respaldo.

## Functions (pure, in `domain/`, each with fixture tests)

| Function | Definition |
| --- | --- |
| `monthSummary(month)` | Income = sum of inflows excluding `transfers` between own accounts and card payments. Spending = sum of outflows excluding `transfers`, `card_payment` and `savings`. Used for the Dashboard pills |
| `spendByCategory(from, to)` | Outflows grouped by `CategoryId`, sorted desc, with share of total |
| `trend(categoryId or all, months)` | Monthly totals for N months, plus month over month change in percent |
| `recurringIncome()` | Inflows grouped by normalized payer with at least 2 occurrences in 3 months at a regular interval (monthly or biweekly ± 3 days, amount ± 15 %). Returns source label, estimated monthly amount, usual day (used for the payday reminder) |
| `categoryIncrease()` | For each category, last 30 days vs the 30 days before. An increase of at least 20 % and at least $20.000 is an opportunity of `last30 - prev30` per month |
| `opportunities()` | Subscriptions low use saving from M9, category increases, payday contribution from M8. No transport plan (removed on 25 Oct 2026) |
| `capStatus(cap, today)` | Spent in the current week (Monday to Sunday, Bogotá) or calendar month for that category, percent, state `ok`, `warning` (≥ 80 %), `reached` (≥ 100 %) |
| `buildSnapshot(today)` | The `AggregateSnapshot` from section 3.5 of the contracts. It must not contain merchant names, account ids, goal names or single movements |

Reference values for tests: Recomendaciones in the design shows `Suscripciones $56.800` and `Restaurantes $45.000`, and "Este mes llevas un 30 % más que el anterior". Build a fixture where restaurants went from 150.000 to 195.000 (30 %, +45.000) and check both numbers. With transport removed, the donut total is `$101.800` for that fixture.

## Screens

* **Gastos por categoría** (new, from the Dashboard "Gastos" pill): period selector (Este mes, Mes anterior, Últimos 3 meses, Personalizado), donut in the Recomendaciones style, list of categories with amount, share and a mini bar, tap opens M7's list filtered.
* **Tendencias** (new, tab inside the same screen): line chart in the Inversión style for 3, 6 or 12 months, all spending or one category, with the month over month change chip.
* **Ingresos recurrentes** (section inside the same screen): sources, estimated monthly amount, usual day.
* **Topes** (new): list of caps with progress bars and states, "Nuevo tope". Form: category (with "Antojos" and its threshold field), period Semanal or Mensual, amount. Opened from Recomendaciones "Fijar tope" with the category and a suggested amount prefilled (previous period's spending rounded to the next $10.000).

## Technical design

* Vault tables through `registerVaultMigrations('analytics', ...)`: `analytics_caps (id, category_id, period, cap_minor, created_at, deleted_at)`, `analytics_settings (treats_threshold_minor)`, `analytics_cap_alerts (cap_id, period_key, level, sent_at)`.
* Cap evaluation runs on `sync.completed`, `transactions.changed` and `vault.unlocked`. It sends M12 notifications once per cap, period and level: "Restaurantes · Llevas el 80 % de tu tope semanal ($160.000 de $200.000)." and "Llegaste a tu tope de Restaurantes esta semana.".
* Results cached in TanStack Query keyed by month and invalidated on the same events.
* Backup collection `analytics.caps` (settings included).
* Exports: `getMonthSummary()`, `useMonthSummary()`, `buildSnapshot()`, `getOpportunities()`, `SpendingScreen`, `CapsScreen`, `openCapForm(categoryId, suggestedMinor)`, `getTreatsThreshold()` (for M7), `getRecurringIncome()` (for M8).

## Work plan (one branch each, from `develop`)

1. `feature/analytics-core-functions`: month summary, by category, trend, with fixtures first.
2. `feature/recurring-income-detection`.
3. `feature/spending-and-trends-screens`.
4. `feature/aggregate-snapshot`: builder plus a test that serializes it and checks no forbidden field or string is present.
5. `feature/spending-caps`: tables, form, evaluation, alerts, backup.

## Tests

* Every function in the table has fixture tests with exact integer results.
* Snapshot test: none of the merchant names or goal names of the fixture appear anywhere in `JSON.stringify(buildSnapshot())`.
* Cap alerts fire once at 80 % and once at 100 % per period, and reset next period.

## Done when

* All criteria pass, every number in Recomendaciones can be traced to a function here, and Gate D passes.

## Ask before

* Adding any field to the snapshot or changing an opportunity rule.
