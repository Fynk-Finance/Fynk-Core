---
date: 2026-11-15
developer: Daniel Palacios
github: Komi-yes
module: M15
jira: [SCRUM-66]
branch: fix/investment-bogota-today
tool: Claude Code
pr: "#386"
status: done
---

# The Inversión tab takes today from the day in Bogotá

## Instruction

After the code analysis of the whole repository, Daniel asked to "fix the bugs with the simple fixes" in the other modules too, and to "push that fixes with their PRs" so each owner reviews them. This is BUG-21 of that analysis, in Julián's module.

## What was done

* `modules/investment/domain/investment.ts`: new `bogotaDate(now)`, the calendar day at the fixed UTC-05:00.
* `modules/investment/ui/InvestmentScreen.tsx`: `today` comes from `bogotaDate(deps.clock.now())`, no longer from the UTC date.
* Tests: `is the calendar day in Bogotá, also after 19:00 and on the last day of the year` (domain) and `uses the day in Bogotá, not in UTC, for the next maturity and the year` (screen). The screen test was run before the change and failed.

## Result

* Tests: `make lint` clean, `make test` passes (247 Jest suites, 2,880 tests, Go and script tests).
* Pull request: #386.
* From 19:00 in Bogotá a CDT that matures today stays in the next maturity tile, and on 31 Dec the yearly interest shows the current year.

## Decisions and problems

* The helper is a copy of the one in M6 and M10, inside M15, because a module does not import another module's domain and `src/shared` belongs to M0.
* The change is in another person's module. Julián reviews it as CODEOWNER.

## Next step

Julián reviews the pull request. One shared `bogotaDate` in `src/shared/domain` would remove the copies, and that is a decision for M0.
