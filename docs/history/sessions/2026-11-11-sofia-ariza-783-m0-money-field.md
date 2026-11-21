---
date: 2026-11-11
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-97]
branch: feature/money-field
tool: Claude Code
pr: none
status: done
---

# MoneyField: amount fields that read $ 30.000 while typing

## Instruction

"Make every amount input follow te cop format. Currently went you enter the money you see for example: 30000. Make that every amount input shows its valuewith the format $ 30.000". Sofia chose to create a new Jira story (SCRUM-97) and a new stack from `develop`.

## What was done

* `shared/ui/components/MoneyField.tsx`:
  * `formatMoneyInput` keeps digits only, drops leading zeros, keeps at most 12 digits of pesos and groups thousands with dots.
  * `MoneyField` is the `TextField` with the "$" prefix and the number pad. It shows and hands back the formatted text, which `parseCopInput` already reads.
* `shared/ui/index.ts` exports both. The catalog's money story uses `MoneyField`; its snapshot gains `inputMode="numeric"`.
* `MoneyField.test.tsx`: format cases, typing and deleting, the prefix and number pad, prefilled values with or without "$".

## Result

* Tests: 2844 of 2844 on the whole stack. Typecheck, ESLint and Prettier clean.
* Pull request: opened at the bottom of the SCRUM-97 stack right after this log.

## Decisions and problems

* The format lives in `shared/ui`, not in `shared/domain/money.ts`, so the frozen shared contract does not change.
* The field keeps the text API of `TextField`, so each module only swaps the component and keeps its parsing.

## Next step

Use it in M6 and M7 (`feature/money-field-accounts-transactions`).
