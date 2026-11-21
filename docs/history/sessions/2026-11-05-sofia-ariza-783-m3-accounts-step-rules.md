---
date: 2026-11-05
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-accounts-step-rules
tool: Claude Code
pr: "#276"
status: done
---

# Rules of the onboarding Cuentas step

## Instruction

Sofia asked to replace the onboarding placeholders with the parts already exported: "These parts are already exported and could be embedded now: BankLinkList and ConnectBankButton (M5), CashInput (M6)." The work is a stack of two pull requests to stay near 400 changed lines. This is the bottom one; the screen is in `feature/onboarding-accounts-step`.

## What was done

* **`accounts/index.ts`** (M6): exports `isConnected`, so onboarding lists exactly the accounts M6 counts as connected.
* **`onboarding/domain/accountsStep.ts`** (new, pure): the bank rows (without cash), the saved cash, "Total registrado" with the typed cash in place of the saved one, and the amount "Continuar" has to save (none when the field is empty or unchanged).
* **`onboarding/testing/accounts.ts`** (new, tests only): the design's accounts, Banco Demo $3.200.000, Billetera Demo $4.600.000 and $600.000 in cash.
* **Tests:** 10 domain tests, including the design total `$8.400.000`.

## Result

* Tests: onboarding domain and accounts suites, 181 pass. `tsc`, ESLint and Prettier are clean.
* Pull request: #276. Bottom of the stack, targets `develop`.

## Decisions and problems

* **M6 decides which account is connected.** The step uses M6's `isConnected` and `balanceTotalMinor` and only swaps in the typed cash, so it never copies M6's rules.
* **An empty cash field never deletes the cash.** M6 has no delete, and the step saves only a typed amount (0 included).

## Next step

The Cuentas screen on top of this branch.
