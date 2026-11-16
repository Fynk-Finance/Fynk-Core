---
date: 2026-11-16
developer: Daniel Palacios
github: Komi-yes
module: M3
jira: [SCRUM-69]
branch: fix/onboarding-cleared-cash-field
tool: Claude Code
pr: "#412"
status: done
---

# An emptied cash field in step 2 saves no cash, as the total shows

## Instruction

After the code analysis of the whole repository, Daniel asked to fix the remaining medium and low bugs: "do the A and B", where A is the list of fixes that stay in one module and need no team decision, and B is the list that touches a shared file or a contract. It is in Sofia's module, so Sofia reviews it as CODEOWNER.

## What was done

* `apps/mobile/src/modules/onboarding/domain/accountsStep.ts`: `cashToSave`.
* Tests: one in `accountsStep.test.ts` (and the old one adjusted), one in `AccountsStepScreen.test.tsx`.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,880 tests, Go and script tests).
* Pull request: #412.
* Emptying the field and pressing "Continuar" saves $0.
* Both tests were run on the old code and failed.

## Decisions and problems

* The save follows the total, not the other way round, because the total already had a test for the empty field.

## Next step

Sofia reviews the pull request and confirms the direction.
