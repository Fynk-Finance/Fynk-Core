---
date: 2026-10-28
developer: Julián Castiblanco
github: JulCR34l
tool: Claude Code
pr: none
status: done
module: M10
jira: [SCRUM-35, SCRUM-36, SCRUM-37]
branch: feature/analytics-core-functions
---

# Pure analytics functions and the aggregate snapshot

## Instruction

Julián asked Claude (claude.ai, Fynk project, session linked to the repository zip): "soy la persona 6, que hace la parte de analytics AI and investment, ayúdame a realizarlo con la información que hay en el repo y con respecto al módulo". Claude followed `docs/modules/M10-analytics.md`, `M11-recommendations.md` and `M15-investment.md`, `00-shared-contracts.md` and the design sources, and built the three modules as one stack of branches.

## What was done

* `modules/analytics/domain`: `monthSummary`, `spendByCategory` (shares that always add up to 100), `trend`, `recurringIncome` (monthly or biweekly ± 3 days, amount ± 15 %, usual day), `categoryIncrease` (≥ 20 % and ≥ $20.000), `opportunities` (low use subscriptions, increases, payday contribution; no transport plan), `capStatus`, `buildSnapshot`, all in integer centavos and Bogotá days.
* Fixtures with the design values: $3.482.400 and 40/18/12/9/8/13 %, $116.080, +$2.097.600, restaurants +30 % / $45.000, donut $101.800.
* Snapshot test: no merchant, description, account, goal name or id of the fixture or of `fixtures/demo-user.json` appears in it, and it stays under 16 KB.

## Result

* 39 tests pass. tsc, ESLint and Prettier clean.

## Decisions and problems

* The work plan's first four branches (core, recurring income, screens, snapshot) were joined in two branches to keep the stack short.
* A category with nothing in the previous 30 days is new spending, not an increase.
* Pending movements count, like booked ones.

## Next step

* `feature/spending-caps`.
