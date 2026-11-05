---
date: 2026-11-05
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-29, SCRUM-32]
branch: feature/manual-movements-update-balances
tool: Claude Code
pr: none
status: done
---

# Manual movements change cash and disconnected accounts (M7 side)

## Instruction

The same team decision as the M6 log of today (`2026-11-05-sofia-ariza-783-m6-manual-movement-balances.md`): "each manual movement reduces cash balance. If the bank accounts are not connected, also modify the bank account balance. If the accounts are connected so do not change manually the balance." This branch makes M7's manual movements use M6's `applyManualMovement`, stacked on the M6 branch.

## What was done

* `application/ports.ts`: `ManualBalancePort` and `ManualBalanceChange` (before and after, with signed amounts).
* `application/manualService.ts`: add, edit and delete send the change to M6 first. If M6 refuses (not enough cash), nothing is saved, marked or announced. If the save or delete fails after M6 applied the change, the opposite change gives the balance back. Delete now reads the movement first, so a bank movement still gets `TransactionNotFoundError` and never touches a balance. Restores do not call M6.
* `index.ts`: passes `applyManualMovement`, and gives the sheet `cashShortOf` built on M6's `InsufficientCashError`.
* `ui/ManualTransactionSheet.tsx`:
  * Lists disconnected accounts after the active ones, with "· Desconectada".
  * Shows "Tu efectivo es $X" under Monto when cash is short.
  * The note follows the account picked (Efectivo, disconnected, connected).
* `ui/strings.es-CO.ts`: the new copy. It replaces "Es un registro: no mueve dinero ni cambia el saldo de tus cuentas." It needs design review.
* `testing/renderScreen.tsx`: a no-op balance port for the screen tests.
* `docs/modules/M07-transactions.md`: the new rule under Screens.
* Tests written first:
  * `manualService.test.ts`, 7 new: Gasto and Ingreso signs; edit with an account change; delete; nothing saved when M6 refuses an add, an edit or a delete; the balance given back when the save fails; no balance change for a bank movement or a restore.
  * `ManualTransactionSheet.test.tsx`, 3 new: the disconnected chip; the note for each kind of account; "Tu efectivo es $30.000", with the sheet staying open.

## Result

* Tests: full mobile suite 212 suites, 2473 tests pass. `tsc --noEmit`, ESLint and Prettier pass.
* Pull request: none yet.
* Not checked on a phone yet.

## Decisions and problems

* The balance changes before the movement is saved, so a refused Gasto never leaves a movement without its balance. Undoing it after a failed save is done in code, not in one database transaction, because the two writes belong to two modules.
* The sheet tests first expected "Banco Demo · Ahorros". The label uses the type name, "Banco Demo · Cuenta de ahorros", so the tests were corrected.
* Not done: when M6 refuses a delete (for example, deleting an Ingreso in cash that was already spent), Detalle de movimiento closes the alert and shows nothing. That was already true for any failed delete. It needs a message and copy.
* `CLAUDE.md` › Decisions taken is not updated yet: it is a shared M0 file, so Sofia decides first.

## Next step

Review of the stack #261 → #262 → M6 → M7. Then the message in Detalle de movimiento when a delete is refused, and the `CLAUDE.md` decision row.
