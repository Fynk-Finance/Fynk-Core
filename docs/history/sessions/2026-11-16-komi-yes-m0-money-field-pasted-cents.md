---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M0
jira: [SCRUM-97]
branch: fix/shared-money-field-pasted-decimals
tool: Claude Code
pr: "#416"
status: done
---

# A money field drops the cents of a pasted amount

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Sofia's module, so Sofia reviews it as CODEOWNER.

## What was done

* `apps/mobile/src/shared/ui/components/MoneyField.tsx`: `formatMoneyInput` cuts at the comma.
* Test: one in `MoneyField.test.tsx`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,879 tests, Go and script tests).
* Pull request: #416.
* Pasted cents no longer multiply the amount.
* The test was run on the old field and failed with 150.050.

## Decisions and problems

* A pasted amount with a decimal dot ("1500.50") is not handled: it cannot be told apart from what the field itself shows while a digit is deleted.

## Next step

Sofia reviews the pull request.
