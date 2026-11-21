---
date: 2026-11-05
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-71]
branch: feature/manual-movement-balances
tool: Claude Code
pr: "#264"
status: done
---

# Manual movements change cash and disconnected accounts (M6 side)

## Instruction

Sofia brought a team decision: "each manual movement reduces cash balance. If the bank accounts are not connected, also modify the bank account balance. If the accounts are connected so do not change manually the balance." In plan mode she chose these details:
* "Not connected" means accounts whose link was revoked or closed.
* A Gasto subtracts and an Ingreso adds.
* Only movements recorded in Efectivo change cash.
* A Gasto bigger than the cash is blocked with a message.

The work is split into two stacked branches. This one is M6. The M7 sheet and service come in `feature/manual-movements-update-balances`.

## What was done

* `domain/manualBalance.ts` (new, pure):
  * `balanceOwner` tells who keeps a balance: cash, a disconnected account, or nobody.
  * `netDeltas` takes the old effect back and applies the new one.
  * `manualBalanceUpdates` gives the new balance, and the available amount for cards, where a Gasto raises the debt.
  * `InsufficientCashError { cashMinor }`.
* `application/manualBalanceService.ts` (new): `applyManualMovement` checks every account, then writes disconnected balances in one transaction (`AccountsStore.setManualBalances`) and cash through the existing `setCash`, which writes the history entry and the backup mark.
* `adapters/vault/vaultAccountsStore.ts`: `setManualBalances` only updates rows that are not active and not manual.
* `AccountsOverview.disconnectedAccounts`: revoked or closed bank accounts, sorted, no CDTs, out of the total and the count.
* `index.ts` exports `applyManualMovement`, `InsufficientCashError` and the `ManualEffect` and `ManualMovementChange` types.
* `docs/modules/M06-accounts.md`: the new rule under Rules.
* Tests written first:
  * `manualBalance.test.ts`, 14 tests.
  * `manualBalanceService.test.ts`, 8 tests on SQLite: cash goes down and so does the total; history and backup mark; delete gives the amount back; nothing written when cash is short; a disconnected account changes and stays out of the total; a connected one never changes; a sync after reconnecting takes the bank balance; the overview lists disconnected accounts.
  * One more case in `index.test.ts`: a manual movement in Efectivo is marked for the backup.

## Result

* Tests: full mobile suite 212 suites, 2463 tests pass. `tsc --noEmit`, ESLint and Prettier pass.
* Pull request: #264, in stack #263 (#261 → #262 → #264 → #265). The stack was rebased on `develop` b77cfb8 (#258, Go only) before pushing.

## Decisions and problems

* Cash is written through `setCash`, so each movement adds a cash history entry and raises the backup version, just like typing the amount.
* The error carries the cash there is now, for the message "Tu efectivo es $X".
* Disconnected bank balances are not backed up (only `accounts.cash` is), and those accounts are not shown on the Dashboard or in Mis cuentas, so their new balance is only visible in M7's sheet.

## Next step

`feature/manual-movements-update-balances` (M7): call `applyManualMovement` on add, edit and delete; offer disconnected accounts in the sheet; the "Tu efectivo es $X" error and the new note.
