---
date: 2026-10-29
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-71]
branch: feature/manual-cash-account
tool: Claude Code
pr: none
status: done
---

# Manual cash account, its history, the accounts.cash backup collection and CashInput

## Instruction

Second step of the M6 work plan: "`feature/manual-cash-account`: cash, history, backup collection, CashInput". HU-054: "Registrar y actualizar efectivo. Aparece como 'Efectivo, registrado manualmente'. Se suma al balance total. Bóveda cifrada y respaldo."

## What was done

* Vault migration 2: `accounts_cash_history (id, amount_minor, set_at)` and a `backup_version` column on `accounts_accounts`, used only by the cash account.
* `domain/cash.ts`: amount check (zero or more whole centavos), the `CashBackupData` records and `parseCashInput` for what the person types.
* `adapters/vault/vaultCashStore.ts`: one cash account (`provider='manual'`, `kind='cash'`, "Efectivo"), updated in place with a history entry per change; export and import of `accounts.cash` (highest version wins, a restored account replaces one typed on the new phone first).
* `application/cashService.ts`: `getCash`, `setCash` (marks the account and the history entry dirty and reloads the accounts) and the backup collection.
* `ui/CashInput.tsx`: the OnbCuentas field ("¿Cuánto tienes en efectivo?", cash icon, `$`, `600.000`).
* `index.ts`: `getCash`, `setCash`, `CashInput`, `cashBackupCollection`.
* Tests: 9 for cash on a real SQLite vault with the in-memory backup registry, 13 for CashInput and the input parser.

## Result

* Tests: 1112 of 1112 in the app. Lint and typecheck clean.
* Pull request: in the M6 stack, above `feature/shared-cash-icon-and-money-prefix`.

## Decisions and problems

* M2 does not export `registerBackupCollection` and `markDirty` yet. The cash service receives them as dependencies; `index.ts` uses a no-op `markDirty` and exports `cashBackupCollection`, with a `TODO(M2) SCRUM-62` to register it once M2 exports the registry. Until then cash lives only in the vault.
* The backup has the account and each history entry as separate records, so no record grows with the history. History entries never change, so their version is always 1.
* Cash is typed in whole pesos, as in the design (`600.000`), at most 12 digits.

## Next step

Dashboard balance card, Detalle de cuentas and Detalle de cuenta (`feature/dashboard-balance-and-account-detail`). Daniel (M2) needs to export the backup registry so `accounts.cash` is backed up.
