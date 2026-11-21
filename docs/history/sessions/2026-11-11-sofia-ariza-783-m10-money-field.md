---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M10
jira: [SCRUM-97]
branch: feature/money-field-caps-investment
tool: Claude Code
pr: none
status: done
---

# Cap, Antojos and calculator amounts read $ 30.000 while typing

## Instruction

Part of "Make every amount input follow te cop format … $ 30.000" (SCRUM-97).

## What was done

* `modules/analytics/ui/CapFormScreen.tsx` (M10): the cap amount and the Antojos threshold use `MoneyField`. Prefilled values (`$200.000`) show as `$ 200.000`.
* `modules/investment/ui/ExploreSection.tsx` (M15): the calculator amount uses `MoneyField`. It is still never prefilled from the balance.
* Tests: a typed cap shows `150.000` and saves 15.000.000 centavos; the prefilled cap and threshold show without their "$"; the calculator types digits and shows `1.000.000`.

## Result

* Tests: 2844 of 2844 on the whole stack. Typecheck and ESLint clean.
* Pull request: opened at the top of the SCRUM-97 stack right after this log. Approval needed: Julián Castiblanco (M10, M15).
* Not checked on the emulator yet: the vault was locked after the reload.

## Decisions and problems

* No parsing changes in either module.

## Next step

Check every field on the emulator, light and dark, and add the screenshots to the PRs.
