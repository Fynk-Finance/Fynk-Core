---
date: 2026-10-28
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-54, SCRUM-56, SCRUM-61]
branch: feature/recurring-amounts-domain
tool: Claude Code
pr: none
status: done
---

# Billetera amounts and the price increase rule (M9 domain)

## Instruction

After M12 step 1 was merged (#86 and #94), Karol let Claude choose the next task: "listo, decide que hacer tu".

## What was done

* Claude first chose the merchant catalog backend of M9 (`feature/merchant-catalog-backend`). It could not be built here: the Go 1.27.3 toolchain the repository asks for cannot be downloaded in this environment. Writing Go without compiling or testing it was not an option, so that branch was dropped before any commit.
* Instead, this branch adds the pure rules of M9 that do not wait for anyone (`modules/recurring/domain/`):
  * `types.ts`: recurring item, kind (`fixed` or `subscription`), periodicity (daily, weekly, biweekly, monthly, yearly), weekday mask, usage mark.
  * `schedule.ts`: `occurrencesInMonth` (4 Mondays, 22 weekdays, one monthly charge) and `nextCharge` (the 31st moves to the 30th in a 30 day month, 29 February to 28 February).
  * `amounts.ts`: `fixedExpensesInMonth` ("Gastos fijos de este mes") and `subscriptionsSummary` (count, monthly total, low use count and saving, the same shape as the analytics snapshot).
  * `priceChange.ts`: `priceIncrease`, which alerts only above max(5 %, $1.000).
* Tests with the reference numbers of the shared contracts: `$1.930.600` in September and October 2026, `4 activas · $112.600/mes`, `Ahorra $56.800 al mes`, `$1.453.900`, 32.900 to 33.500 gives no alert and 32.900 to 36.900 gives +$4.000.

## Result

* Tests: 25 pass. ESLint, `tsc` and Prettier are clean on the module.
* Pull request: not opened yet.

## Decisions and problems

* Biweekly and yearly items need a start date (`anchorDate`). The vault table in the M9 prompt has `anchor_day` and `weekdays_mask` only, so `feature/recurring-items-manual` has to add an `anchor_date` column.
* The monthly amount of a subscription is its charges inside the current month, the same rule as "Gastos fijos de este mes".
* The merchant catalog backend needs a session with Go 1.27, for example on Karol's computer.

## Next step

Open the pull request. Then `feature/recurring-detection` (the detection algorithm on the M16 fixture), or build the catalog backend where Go 1.27 is available.
