# M9 Recurring expenses and subscriptions (subscription killer)

| Item | Value |
| --- | --- |
| Phase | 3 (the catalog backend can start in Phase 2) |
| Stories | HU-038 SCRUM-54 (3), HU-039 SCRUM-55 (8), HU-040 SCRUM-56 (5), HU-041 SCRUM-57 (3), HU-042 SCRUM-58 (3), HU-044 SCRUM-61 (2) |
| Points | 24 |
| Owner | Karol (`@Karol2905`) |
| Owns | `apps/mobile/src/modules/recurring/`, `services/api/internal/catalog/`, `contracts/modules/catalog.yaml` |
| Depends on | M2 (vault, backup), M7 (movements, `normalizeMerchant`), M12 (reminders), M16 (fixture with recurring charges) |
| Used by | M3 (onboarding step 5), M7 (catalog categories), M10 (totals for the snapshot), M11 (Suscripciones step) |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M9 of Fynk: fixed expenses and subscriptions, their automatic detection, usage marks, savings potential, reminders, price increase alerts and cancellation guidance. Detection runs on the phone. The backend only serves a shared catalog of merchants with no personal data. Fynk never cancels anything for the user.

## Read first

1. `CLAUDE.md`, `docs/modules/00-shared-contracts.md` sections 2, 3 and 7 (reference numbers).
2. Design screens `Billetera` (lower part), `OnbGastos`, `Notificaciones` and `Recomendaciones`. Read the code of these screens in `docs/design/sources/light/` and `docs/design/sources/dark/` first (inventory, gestures and transitions in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs in `docs/design/screens/light/` and `docs/design/screens/dark/` are for checking the result. Every screen works in light and dark (colors only from `useTheme()`), and uses the default transition and back gesture of its kind unless the inventory says otherwise.
3. Jira SCRUM-54 to SCRUM-58 and SCRUM-61.

## Stories and criteria

* **HU-038 Registrar (SCRUM-54)** Nombre, tipo (gasto fijo o suscripción), monto, periodicidad (diaria, semanal, mensual) y día de cobro. Total mensual equivalente. Editar y eliminar. En el paso 5 y en Billetera. Bóveda cifrada.
* **HU-039 Detectar (SCRUM-55)** Mismo comercio, monto similar y periodicidad regular sobre 12 meses. Catálogo compartido de comercios. El usuario confirma o descarta. Próxima fecha de cobro. Detección en el dispositivo.
* **HU-040 Poco uso (SCRUM-56)** El usuario marca el uso. Ahorro mensual potencial de las de poco uso. Se muestra en Billetera y alimenta recomendaciones. Montos verificables.
* **HU-041 Recordatorios (SCRUM-57)** 2 días antes por defecto. Activar o desactivar. Notificaciones locales, sin segundo plano. También en Notificaciones.
* **HU-042 Guía de cancelación (SCRUM-58)** Enlace o pasos desde el catálogo. Fynk no cancela. Marcar como cancelada y dejar de contarla. Catálogo sin datos personales.
* **HU-044 Aumento de precio (SCRUM-61)** Compara con el cobro anterior del mismo comercio. Avisa si sube más de 5 % o $1.000, lo que sea mayor. Muestra valor anterior, nuevo y diferencia mensual. En Notificaciones y junto a la suscripción en Billetera.

The user also wants to see, for every subscription, which recurring payment it is: show the account or card it is charged to and link to its movements.

## Detection algorithm (pure, in `domain/detect.ts`)

1. Input: outflows of the last 12 months from M7 `getTransactionsBetween`, grouped by `merchantKey`.
2. Keep groups with at least 3 charges, or 2 charges when the catalog marks the merchant as a subscription.
3. Intervals between consecutive charges. Classify by median interval: daily on weekdays (1 to 3 days with weekends skipped), weekly (7 ± 2), biweekly (14 ± 3), monthly (28 to 33, or same day of month ± 3), yearly (360 to 370).
4. Amount check: subscriptions and fixed amounts within ± 10 % of the median. Utilities (`utilities`, `telecom`) allowed ± 35 %.
5. Score 0 to 1 from interval regularity, amount stability and catalog match. Propose when score ≥ 0,7. Never auto confirm.
6. Kind: `subscription` when the catalog says so or the category is `subscriptions`, otherwise `fixed`.
7. Next charge: last charge plus median interval. Monthly ones keep the day of month (clamp to the last day).
8. The amount of a detected item is its most recent charge. The user can edit it.
9. A proposal the user dismissed is not proposed again for that `merchantKey` unless the amount changes by more than 30 %.

**Monthly equivalent** for "Gastos fijos de este mes": count occurrences inside the current calendar month. Weekly on Mondays in a month with 4 Mondays gives ×4. Daily on weekdays in a month with 22 weekdays gives ×22. Monthly gives ×1. This reproduces `$1.930.600` with the reference data. For the onboarding "Total mensual" use the amount per month of each item as entered.

**Low use saving** = sum of the monthly amount of confirmed subscriptions marked `low`. Reference: `$56.800` from 32.900 + 23.900.

**Price increase** (`domain/priceChange.ts`): when a new charge of a confirmed subscription is higher than the previous charge by more than max(5 %, $1.000), create an alert once per charge: "Streaming de series subió de $32.900 a $36.900 (+$4.000 al mes)."

## Screens

* **Billetera** (owned together with M6): header "Billetera · Gastos fijos de este mes · $1.930.600". Section "Gastos recurrentes" with "+ Agregar", 2 column cards (icon, name, amount, periodicity badge "Mensual", "Semanal", "Diario", schedule "Día 1", "Cada lunes", "Lun a vie", status chip "Pagado", "En 2 días", "Hoy", "Lun 29"). Banner "OPORTUNIDAD DE AHORRO · Ahorra $56.800 al mes · 2 suscripciones que casi no usas" with chevron to the subscriptions filtered by low use. Section "Suscripciones · 4 activas · $112.600/mes" with rows (lime icon tile, name, "Poco uso" chip, "Tarjeta de crédito · renueva 28 sep", amount) and a red "Subió" chip when a price alert is open.
* **Detalle de suscripción** (new): amount, periodicity, next charge, account or card, last 6 charges from M7, usage selector "¿Cuánto la usas? Mucho, A veces, Casi nunca", reminder toggle, "Cómo cancelarla" (steps and button "Abrir página de cancelación" from the catalog, opened in the browser), "Ya la cancelé" (stops counting it), "No es una suscripción".
* **Detectamos pagos recurrentes** (new, shown after a sync with new proposals): list with confirm and dismiss per item.
* **RecurringForm** and **RecurringQuickList** (used by onboarding step 5): name, type, amount, periodicity, day, remove buttons, "Total mensual" box with "Te avisaremos 2 días antes de cada pago".

## Technical design

* Vault tables through `registerVaultMigrations('recurring', ...)`: `recurring_items (id, kind, name, merchant_key, amount_minor, periodicity, anchor_day, weekdays_mask, account_id, status, usage, reminder_enabled, source, created_at, cancelled_at)`, `recurring_proposals (merchant_key, score, data_json, status, decided_at)`, `recurring_price_alerts (id, item_id, previous_minor, new_minor, detected_at, dismissed_at)`.
* Run detection on `sync.completed` (incremental: only groups with new movements) and once after the first full sync. Emit `recurring.detected`.
* Reminders: on every change and after each sync, reschedule the next charge of each enabled item with M12 `schedule` at 9:00 Bogotá time 2 days before ("Servicios públicos · Vence en 2 días: $186.000."), and a renewal notice for subscriptions ("Streaming de video · Se renueva el 28 sep por $38.900.").
* Backup collections `recurring.items` and `recurring.usage_marks`.
* Exports: `RecurringSection`, `SubscriptionsSection`, `SavingsOpportunityBanner`, `RecurringForm`, `RecurringQuickList`, `SubscriptionDetailScreen`, `getRecurringMonthlyTotal()`, `getFixedExpensesThisMonth()`, `getSubscriptionsSummary()`, `getCatalogCategory(merchantKey)` (for M7).

### Catalog backend (`services/api/internal/catalog/`)

* Schema `catalog.merchants (key, display_name, category, is_subscription, match_patterns text[], cancel_url, cancel_steps_md, updated_at)`. Seed at least 40 merchants common in Colombia (streaming, music, cloud storage, gyms, telecom, utilities, transport apps) with their official cancellation pages. Content only, no personal data.
* `GET /catalog/merchants` returns the full list with `ETag`. The phone caches it in the vault and revalidates once a day while the app is open.

## Work plan (one branch each, from `develop`)

1. `feature/merchant-catalog-backend`: schema, seed, endpoint with ETag.
2. `feature/recurring-items-manual`: tables, form, quick list, monthly equivalents, backup.
3. `feature/recurring-detection`: algorithm with fixtures, proposals screen.
4. `feature/subscriptions-usage-and-savings`: usage marks, low use saving, Billetera sections and banner.
5. `feature/recurring-reminders-and-price-alerts`: reminders with M12, price change detection, red chip.
6. `feature/subscription-cancellation-guide`: detail screen, catalog guidance, cancelled state.

## Tests

* Reference numbers: `4 activas · $112.600/mes`, `Ahorra $56.800 al mes`, `$1.930.600`, `$1.453.900`.
* Detection on the M16 fixture: every seeded recurring charge found, no one off purchase flagged, utilities with variable amounts found.
* Price alert: 32.900 to 33.500 (+600, under $1.000 and under 5 %) gives no alert. 32.900 to 36.900 gives one.
* Reminder scheduled for 2 days before at 9:00 Bogotá time, moved correctly when the charge day falls on the 31st of a 30 day month.

## Done when

* All criteria pass and the Gate D subscription items pass on staging.

## Ask before

* Using any data about how much a service is used other than the user's own mark, or adding automatic cancellation.
