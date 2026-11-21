---
date: 2026-10-29
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-54]
branch: feature/recurring-items-store
tool: Claude Code
pr: none
status: done
---

# Recurring items in the vault (first of three pull requests for SCRUM-54)

## Instruction

With M2's vault in `develop`, Karol agreed to start SCRUM-54 and asked Claude to push and open the pull requests from her account directly: "si, puedes de una vez hacer los cambios y pr automaticamente desde la cuenta de karol2905".

## What was done

* SCRUM-54 is split into three pull requests: this one (vault and service), the form, and the Billetera section.
* `domain/item.ts`: the stored item and `validateRecurring`, with errors per field for the form. It checks the name (1 to 40 characters), a positive whole amount up to $100.000.000, and the charge day, weekdays or date of each periodicity.
* Vault migration 1 of `recurring`: table `recurring_items`, as in the M9 prompt plus `category_id` and `anchor_date` (biweekly and yearly items need a date, as noted in #95).
* `adapters/vault/vaultRecurringStore.ts`: the store. The schedule is kept in `anchor_day`, `weekdays_mask` or `anchor_date`.
* `application/recurringService.ts`: add, edit (keeps id, creation time and source), delete, list the active items, and the totals of the current month in Bogotá.
* `index.ts`: registers the tables with M2's vault and exports `getFixedExpensesThisMonth()` and `getSubscriptionsSummary()`. The Billetera tab is still M0's placeholder.
* Tests: validation (6) and the service on the sql.js vault (11), with the design's Billetera: `$1.930.600`, `4 activas · $112.600/mes` and `$1.453.900`.

## Result

* Tests: 73 suites and 998 tests of the app pass. ESLint, `tsc` and Prettier are clean.
* Pull request: opened from Karol's account in the built-in browser. The branch is pushed with this session's GitHub connection.

## Decisions and problems

* "Eliminar" deletes the row. "Ya la cancelé" (SCRUM-58) will set `status = 'cancelled'` instead, so a cancelled subscription stops counting but stays in the history.
* The backup collection `recurring.items` waits for M2 to export `registerBackupCollection`.

## Next step

The form (`feature/recurring-form`), then the Billetera section.
