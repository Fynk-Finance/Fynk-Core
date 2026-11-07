---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-29]
branch: fix/transaction-account-after-revoke
tool: Claude Code
pr: "#331"
status: done
---

# Keep the account name of movements after a bank link is revoked

## Instruction

From the follow-ups of the M4 and M5 end-to-end test: "After revoking a bank connection, the account name disappears from the transactions on the Dashboard. Before revocation, it displays 'Savings account · Oct 26,' but afterward, it shows only 'Oct 26.'"

## What was done

* Cause: M6's `markLinkRevoked` moves the link's accounts from `accounts` to `disconnectedAccounts`, and M7 looked accounts up only in `accounts`. The same bug removed the entity from Movimientos ("Salario · Bancolombia" → "Salario") and showed "—" as the account in the movement detail.
* `transactions/ui/labels.ts`: `knownAccounts(data)` joins `accounts` and `disconnectedAccounts`, and an `AccountsData` type for M6's data.
* `TransactionPreview.tsx`, `AllTransactionsScreen.tsx`, `TransactionDetailScreen.tsx` use it. FiltersSheet still lists active accounts only.
* Tests: a movement whose account is only in `disconnectedAccounts` keeps "Cuenta de ahorros · 26 oct" (Dashboard), "Salario · Bancolombia" (Movimientos) and "Bancolombia · Cuenta de ahorros" (detail). There is also a unit test for `knownAccounts`.

## Result

* Tests: 351 of 351 pass in `transactions` and `accounts`. ESLint, Prettier and `tsc --noEmit` are clean.
* Pull request: #331.

## Decisions and problems

* The fix is in M7, which reads the data M6 already gives (`disconnectedAccounts`). No new M6 API was needed.
* CDTs of a revoked link are not in `disconnectedAccounts` (M6 leaves them out). They have no movements in the demo data, so this was left as is.

## Next step

Check on the emulator: revoke Banco Demo and see that the Dashboard rows keep "Cuenta de ahorros · <fecha>".
