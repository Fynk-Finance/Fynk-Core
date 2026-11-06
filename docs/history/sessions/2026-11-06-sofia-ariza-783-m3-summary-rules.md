---
date: 2026-11-06
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M3
jira: [SCRUM-69]
branch: feature/onboarding-summary-rules
tool: Claude Code
pr: none
status: done
---

# Add the rules of the Listo summary

## Instruction

Part of Sofia's request to "complete all the onboarding module". Listo has to summarize "correo, cuentas y efectivo, metas y gastos recurrentes con sus totales" (SCRUM-69), plus the "Código de recuperación" row from the M3 prompt.

## What was done

* **`onboarding/domain/summary.ts`** (new, pure): `summaryRows(input)` builds Listo's rows in the design's order from the numbers of M6, M8, M9 and M2: Correo (always verified, ADR 0007), Cuentas y efectivo (connected accounts plus the cash when it is above zero, with M6's balance total), Metas de ahorro and Gastos recurrentes (count and month), and Código de recuperación last.
* **Tests:** `summary.test.ts`, 6 tests: the design's `3 registradas $8.400.000`, `2 metas $840.000` and `4 pagos $1.453.900`, the order, the email with nothing else, every part pending with nothing registered, the cash counting as one account only above zero, and no recovery row without M2's answer.

## Result

* Tests: onboarding domain, 4 suites, 67 pass. `tsc`, ESLint and Prettier are clean.
* Pull request: in the M3 stack, on top of M2's #296.

## Decisions and problems

* **The plan changed:** the plan put the new "Listo" progress step in this pull request. Alone, it would leave the app on step 4 after "Terminar configuración", because the screen comes later. So this pull request holds only the pure rules, the next one adds the progress step with the screen, and a third adds the design's motion.
* A row is pending when its module holds nothing, whether the step was skipped or finished empty: Listo shows what was registered, not which button was pressed.
* With no answer from M2 (offline, or a build without backup), the recovery row is left out instead of showing a guess.

## Next step

The Listo screen, the progress step `done`, and "Ir a mi dashboard".
