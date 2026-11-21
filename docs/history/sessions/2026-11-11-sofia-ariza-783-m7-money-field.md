---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-97]
branch: feature/money-field-accounts-transactions
tool: Claude Code
pr: none
status: done
---

# Cash, movement and filter amounts read $ 30.000 while typing

## Instruction

Part of "Make every amount input follow te cop format … $ 30.000" (SCRUM-97).

## What was done

* `modules/accounts/ui/CashInput.tsx` (M6): drawn with `MoneyField`. It already showed dots; now it shares one path with the other fields. Onboarding (M3) uses this field.
* `modules/transactions/ui/ManualTransactionSheet.tsx` (M7): the amount of "Registrar gasto o ingreso" uses `MoneyField`.
* `modules/transactions/ui/FiltersSheet.tsx` (M7): "Mínimo" and "Máximo" use `MoneyField`.
* Tests: typing `30000` shows `30.000` and saves −3.000.000 centavos; the filters show `50.000` and `200.000` from digits.

## Result

* Tests: 2844 of 2844 on the whole stack.
* Pull request: opened in the SCRUM-97 stack right after this log. No other approval needed (M6 and M7 are Sofia's).

## Decisions and problems

* No parsing changes: `parseCopInput` reads the dotted text.

## Next step

M8 and M9 (`feature/money-field-savings-recurring`).
