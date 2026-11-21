---
date: 2026-10-28
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-55]
branch: feature/recurring-detection
tool: Claude Code
pr: none
status: done
---

# Detection of recurring payments (M9 domain)

## Instruction

After #95 was merged, Karol asked to go on: "listo, sigue". Claude had proposed the detection algorithm as the next M9 step because it is pure and can be tested on the shared fixture.

## What was done

* `modules/recurring/domain/detect.ts`: `detectRecurring`, steps 1 to 9 of the M9 prompt. It groups booked outflows by `merchantKey` and keeps groups with 3 charges, or 2 when the catalog says the merchant is a subscription. It classifies the rhythm by the median interval: daily on the weekdays seen, weekly on the most common weekday, biweekly, monthly on the most common day of the month, or yearly. Amounts must be within ± 10 % of the median, or ± 35 % for utilities and telecom. The score is 0,45 for regularity, 0,45 for amount stability and 0,1 for a catalog match, and a group is proposed at 0,7 or more. Each proposal has a kind, the amount of the last charge, the next charge, the account or card of the last charge and the movements behind it. A dismissed proposal returns only after an amount change of more than 30 %.
* `detect.test.ts`: 16 tests. On `fixtures/demo-user.json` it finds the 8 seeded recurring payments: rent on day 1, utilities with a variable amount, the gym every Monday, transport Monday to Friday, and 4 subscriptions that add up to $112.600. It flags none of café, restaurants, supermarket, the 3 big purchases, or moves between own accounts. Hand-made cases cover the 2-charge catalog rule, ± 10 % against ± 35 %, the 31st in a 30 day month, the latest amount, a stopped payment, dismissed proposals, biweekly charges and Bogotá calendar days.

## Result

* Tests: 41 in the module pass (16 new). ESLint, `tsc` and Prettier are clean.
* Pull request: not opened yet.

## Decisions and problems

* Transfers, card payments, savings and income are never proposed: they move the person's own money and would count it twice. The M9 prompt does not say this; it follows from what a recurring expense is.
* A payment with no charge for two periods (for example 65 days for a monthly one) is not proposed, so a service the person already cancelled does not come back.
* The catalog is passed as a lookup function. The real one comes from `GET /catalog/merchants` when the catalog backend is built (it needs Go 1.27, not available in this session).

## Next step

Open the pull request. Then `feature/recurring-items-manual` when M2's vault is in `develop`, or the catalog backend where Go 1.27 is installed.
