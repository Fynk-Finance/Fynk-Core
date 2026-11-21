---
date: 2026-11-04
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-53]
branch: feature/savings-income-share
tool: Claude Code
pr: none
status: done
---

# "23 % de tus ingresos" in Metas

## Instruction

Karol said "si" to the next item: show "23 % de tus ingresos va a tus metas" in Metas with M10's income. Until now Metas received `monthlyIncome: async () => null`.

## What was done

* **`domain/income.ts` (pure):**
  * `monthlyIncome(recurring, lastFullMonth)` adds the recurring income M10 estimates (`estimatedMonthlyMinor`). Without it, it uses the income of the last full month, and it is null when there is no income.
  * `previousMonth(today)`.
* **`index.ts`:** `incomeForMetas` reads M10's `getRecurringIncome()` and `getMonthSummary(previous month)`. Each read falls back to nothing if M10 is not configured yet, and Metas then hides the share, as before.
* **Tests:** `domain/income.test.ts` (5):
  * recurring income added up;
  * fallback to the last full month;
  * null without income;
  * the design's 23 % ($840.000 of $3.650.000);
  * `previousMonth` across a year.
* The ring was already tested with an income in `MetasScreen.test.tsx`.

## Result

* 202 suites and 2410 tests pass. ESLint, tsc and Prettier are clean.
* **It shows only once M10 is installed.** Nobody calls `configureAnalytics` yet (M10/M0). Until then M10 throws, and Metas keeps hiding the share.

## Decisions and problems

* **Not the current month.** Early in the month the payday may not have arrived, so the share would look too high. Recurring income is the steadiest number, and the last full month is the fallback.

## Next step

"Programar" in Recomendaciones (the payday reminder), using `usualDay` from M10's recurring income.
