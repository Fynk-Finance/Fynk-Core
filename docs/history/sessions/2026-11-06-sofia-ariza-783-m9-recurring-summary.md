---
date: 2026-11-06
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M9
jira: [SCRUM-69]
branch: feature/recurring-summary-for-onboarding
tool: Claude Code
pr: "#295"
status: done
---

# Export the count and month of the recurring items for onboarding's Listo

## Instruction

While finishing M3, Sofia asked to "complete all the onboarding module". The Listo screen shows "Gastos recurrentes · 4 pagos · $1.453.900/mes", and M9 only exported the total. Asked how to get the count, Sofia chose a small pull request in M9 reviewed by its owner (@Karol2905), rather than a stub in M3.

## What was done

* **`recurring/domain/amounts.ts`:** `recurringSummary(items, month)`, pure: the active fixed expenses and subscriptions, and their month with the same rule as `fixedExpensesInMonth`.
* **`recurring/application/recurringService.ts`:** `recurringSummary()` on the current Bogotá month.
* **`recurring/index.ts`:** `getRecurringSummary()` and the `RecurringSummary` type.
* **Tests:** the Billetera design (8 items, $1.930.600), a cancelled item left out, no items; and the onboarding design in the service test: 4 items, $1.453.900.

## Result

* Tests: recurring, 26 suites, 187 pass. `tsc`, ESLint and Prettier are clean.
* Pull request: #295, in the M3 stack, under the Listo pull requests. Needs @Karol2905's approval.

## Decisions and problems

* The count uses the same "active" rule as the totals, so the number and the amount never disagree.

## Next step

M2's recovery code status, then the Listo rules.
