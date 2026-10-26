# M6 Accounts, cards, wallets and cash

| Item | Value |
| --- | --- |
| Phase | 2 |
| Stories | HU-012 SCRUM-26 (3), HU-013 SCRUM-27 (3), HU-014 SCRUM-28 (5), HU-019 SCRUM-33 (3), HU-020 SCRUM-34 (3), HU-054 SCRUM-71 (2) |
| Points | 19 |
| Owner | Sofia Nicolle Ariza |
| Owns | `apps/mobile/src/modules/accounts/` |
| Depends on | M2 (vault), M5 (accounts written by sync), M7 (movement list component for account detail) |
| Used by | M3, M10, M15, Dashboard |

How to use: open Claude Code at the repository root on a fresh branch from `develop` and paste everything below the line.

---

You are building module M6 of Fynk: the account model on the phone, balances, consolidated net worth, cards, digital wallets and the manual cash account. There is no backend in this module.

## Read first

1. `CLAUDE.md`, `docs/modules/00-shared-contracts.md` sections 2, 3.1, 3.2 and 7.
2. Design PNGs `05-dashboard.png`, `06-dashboard-detalle-cuentas.png`, `07-mi-cuenta.png` and `07-mi-cuenta-2.png`, `09-billetera.png` and `09-billetera-2.png`, `15-config-cuentas.png`. Read the code of the same screens in `docs/design/source/` first (file map in `docs/design/README.md`) and take exact values, SVGs and animations from it. The PNGs are for checking the result.
3. Jira SCRUM-26, SCRUM-27, SCRUM-28, SCRUM-33, SCRUM-34, SCRUM-71.

## Stories and criteria

* **HU-012 (SCRUM-26)** Todas las cuentas activas, saldo actual, entidad y tipo, carga rápida y consistente.
* **HU-013 (SCRUM-27)** Datos básicos, saldo actual, historial asociado, datos sincronizados.
* **HU-014 (SCRUM-28)** Agrega cuentas, tarjetas y billeteras conectadas. Sin datos de inversión. Sin duplicados. Total consolidado. Cálculos consistentes.
* **HU-019 (SCRUM-33)** Cupo total, cupo disponible y fecha de pago. Solo últimos 4 dígitos. Entidad emisora. Cambios sincronizados. Las tarjetas aparecen en "Mis cuentas" de Mi cuenta.
* **HU-020 (SCRUM-34)** Todas las billeteras vinculadas, saldo disponible, fecha de actualización, consistencia con el proveedor.
* **HU-054 (SCRUM-71)** Registrar y actualizar efectivo. Aparece como "Efectivo, registrado manualmente". Se suma al balance total. Bóveda cifrada y respaldo.

## Rules

* **Balance total** = sum of `balanceMinor` of active accounts of kind `savings`, `checking`, `wallet` + cash, minus the amount owed on active `credit_card` accounts. `cdt` accounts are excluded (investment data stays in the Inversión tab, HU-014). Show the formula in a tooltip "Cómo se calcula".
* **"N cuentas conectadas"** counts active bank accounts and wallets, without cash and CDTs.
* Duplicates: one row per `(provider, providerAccountId)`. Cash is a single account with `provider='manual'`, `kind='cash'`.
* **Ingresos and Gastos** on the Dashboard card come from M10 `getMonthSummary()` (current calendar month). Until M10 lands, compute them with a temporary function marked `TODO(M10)`.
* Every amount through the shared `formatCop`. Card and account numbers as `•• 4821`.
* Accounts from simulated providers show the "Simulado" badge.

## Screens

* **Dashboard header** (`DashboardBalanceCard`): "Hola, <nombre>", bell, card "Balance total", amount, "COP · N cuentas conectadas", pills Ingresos and Gastos, and the chevron that expands **Detalle de cuentas**: one row per account with entity, "Cuenta de ahorros · ••4821", balance, and the cash row "Efectivo · Registrado manualmente". The rest of the Dashboard (Planes de ahorro, Movimientos) is rendered by M8 and M7 components.
* **Billetera, "Mis cuentas"**: horizontal cards (logo tile, "Banco Demo · Ahorros", balance, chevron), "+ Conectar" opens M5. The header "Gastos fijos de este mes" belongs to M9.
* **Mi cuenta, "Mis cuentas"** (renamed from "Mis tarjetas"): horizontal cards with entity, "Activa" badge, "Saldo disponible", masked number, type. Credit cards show "Cupo disponible", "Cupo total" and "Pago el <fecha>".
* **Detalle de cuenta** (new): header with entity, type, masked number, balance, last update ("Actualizado hace 5 min"), for cards also the credit data, then M7's `TransactionList` filtered by this account, with pull to refresh.
* **CashInput** (used by onboarding step 3 and by an "Editar efectivo" action): money field with the cash icon.

## Technical design

* Vault tables through `registerVaultMigrations('accounts', ...)`: `accounts_accounts` with the `Account` fields, `accounts_cash_history (id, amount_minor, set_at)`, `accounts_balance_history (account_id, on_date, balance_minor, primary key (account_id, on_date))` written once per day per account on sync (used by M15's chart).
* Write API for M5 only: `upsertFromSync(accounts: Account[])`, `markLinkRevoked(linkId)`. Everyone else reads.
* Read API in `index.ts`: `useAccounts()`, `getAccounts()`, `getBalanceTotal()`, `getConnectedAccountsSummary()` (count and total, used by M3), `getCdtAccounts()` and `getBalanceHistory(accountIds, from)` (used by M15), `setCash(amountMinor)`, plus the screens and components above.
* Register backup collection `accounts.cash`.
* Recompute derived values on `sync.completed` and `vault.unlocked`, keep them in TanStack Query with the key `['accounts']`.

## Work plan (one branch each, from `develop`)

1. `feature/accounts-model-and-net-worth`: tables, write API for M5, net worth function with tests.
2. `feature/manual-cash-account`: cash, history, backup collection, CashInput.
3. `feature/dashboard-balance-and-account-detail`: Dashboard card, Detalle de cuentas, Detalle de cuenta screen.
4. `feature/cards-and-wallets-in-mi-cuenta-and-billetera`: Mis cuentas in both places.

## Tests

* Net worth with fixture: Banco Demo ahorros 3.200.000, Billetera Demo 4.600.000, cash 600.000 gives `$8.400.000`. Adding a card with 500.000 owed gives `$7.900.000`. A CDT does not change the total.
* A revoked link's accounts disappear from the total and the count.
* Masking never shows more than 4 digits, including in accessibility labels.

## Done when

* All criteria pass and the Gate C Dashboard item passes on staging.

## Ask before

* Including CDTs or investments in the total, or changing how credit card debt is counted.
