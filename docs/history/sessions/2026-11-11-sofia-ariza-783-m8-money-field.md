---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M8
jira: [SCRUM-97]
branch: feature/money-field-savings-recurring
tool: Claude Code
pr: none
status: done
---

# Goal, Abonar, payday and recurring amounts read $ 30.000 while typing

## Instruction

Part of "Make every amount input follow te cop format … $ 30.000" (SCRUM-97).

## What was done

* `modules/savings` (M8):
  * The goal target (`GoalFormFields.tsx`) and the payday reminder amount (`PaydayReminderScreen.tsx`) use `MoneyField`.
  * "Otro monto" in `AbonarBox.tsx` keeps its own field from the design and formats with `formatMoneyInput`.
* `modules/recurring` (M9): the amount in `RecurringFormFields.tsx` uses `MoneyField`.
* Placeholders `$0` become `0` in both modules, because the "$" is now the field's prefix.
* Tests: the goal form, Abonar, the payday reminder and the recurring form each type digits, see dots and check the saved amount.

## Result

* Tests: 2844 of 2844 on the whole stack.
* Pull request: opened in the SCRUM-97 stack right after this log. Approval needed: Karol (M8, M9).

## Decisions and problems

* Onboarding's goal and fixed expense steps reuse these fields, so they get the format too.

## Next step

M10 and M15 (`feature/money-field-caps-investment`).
