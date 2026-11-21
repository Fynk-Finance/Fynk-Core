---
date: 2026-11-04
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-58, SCRUM-56]
branch: feature/subscription-account-and-charges
tool: Claude Code
pr: none
status: done
---

# The account or card of each subscription and its last charges

## Instruction

Karol said "si" to the next step while the detection PR waits for review: the account or card of each subscription and its last 6 charges. The M9 prompt asks to "show the account or card it is charged to and link to its movements".

## What was done

* **`domain/charges.ts` (pure):**
  * `lastCharges(item, movements)`: the last 6 booked charges of the item's merchant, newest first.
  * `chargedAccount(item, accounts)`.
* **`ui/accountLabel.ts`:**
  * "Tarjeta de crédito" in Billetera;
  * "Tarjeta de crédito •• 4821" in the detail, never more than the last 4 digits.
  * The kind names are copied into M9's strings, because strings are per module.
* **Billetera:**
  * the subscription row shows "Tarjeta de crédito · renueva 28 sep", as in the design;
  * new optional dependency `accounts` (M6 `getAccounts`);
  * new hook `useAccounts`.
* **Detalle de suscripción:**
  * "Se cobra a" with the account;
  * "Últimos cobros", read from M7's `getTransactionsBetween` over one year, with the day in Bogotá and the amount. Each charge opens M7's movement detail (`TRANSACTION_DETAIL_ROUTE`).
* **`index.ts`:** wires `getAccounts`, `getTransactionsBetween` and `TRANSACTION_DETAIL_ROUTE`.
* **Tests:**
  * `domain/charges.test.ts` (3) and `ui/accountLabel.test.ts` (1);
  * `ui/SubscriptionCharges.test.tsx` (4): the card with the last 4 digits only; the charges newest first in Bogotá days; opening a movement; the note for an item typed by hand;
  * one more test in `BilleteraScreen.test.tsx`.

## Result

* 200 suites and 2400 tests pass after the rebase on #250 and #251. ESLint, tsc and Prettier are clean.

## Decisions and problems

* **Charges match by merchant.** Only items that come from detection have a `merchantKey`, so an item typed by hand shows a note instead of charges. Matching by name or amount would show the wrong movements.
* **Rebase.** Detection (#251) was merged during the session; a one-line conflict in the imports of `recurring/index.ts` was resolved. A subscription confirmed from a detected proposal now has a merchant, so its charges show.

## Next step

The "Detectamos pagos recurrentes" screen, now that detection (#251) is merged.
