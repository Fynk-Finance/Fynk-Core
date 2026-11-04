---
date: 2026-11-03
developer: Julián Castiblanco
github: JulCR34l
module: M10
jira: [SCRUM-35, SCRUM-36, SCRUM-37, SCRUM-60, SCRUM-38, SCRUM-39, SCRUM-40]
branch: feature/analytics-wiring
tool: Claude Code
pr: none
status: done
---

# Install the analytics and recommendations modules with the real data of M2, M7, M8, M9 and M12

## Instruction

Julián asked to move tasks to done and finish modules, starting from an analysis of the repository: "la idea es avanzar con tareas realizadas, así que empecemos a terminar ciertos módulos".

## What was done

* Analysis of `develop`: M10's functions, caps and screens were merged (#163, #171), but nothing called `configureAnalytics`, so Análisis, Topes and Recomendaciones showed "no disponible". Every source M10 needs is now exported: M7 `getTransactionsBetween`, M9 `getSubscriptionsSummary` and `getFixedExpensesThisMonth`, M2 vault and backup, M12 `notificationsPort`, and M8 `getGoalsForSnapshot` and `getPaydayContribution` (#246, Karol).
* `analytics/index.ts`: the module installs itself when it loads, like M7, M8 and M9. Vault tables and the `analytics.caps` backup collection with M2, cap alerts through M12. The sources are called lazily, so the import cycle with M7 (which reads `getTreatsThreshold`) is safe.
* `application/hooks.ts`: `notifyAnalyticsChanged()`; every analytics query refetches on sync, movement changes and vault unlock.
* `recommendations/index.ts`: Recomendaciones installs itself the same way, with M2's vault and M10's report. "Programar" opens Metas and "Revisar" opens Billetera (their default targets), and the header shows "Invitado", because M1 does not export the profile name yet (the Dashboard does the same).
* `recommendations/index.test.ts`: the module registers its vault tables, installs the service and shows M10's opportunities from the cache without calling the model.
* `analytics/index.test.ts`: the module registers its migrations and backup collection, reads the month from M7, and builds the snapshot with M9's subscriptions and fixed expenses and M8's goals.

## Result

* Mobile, checked together with #246: tsc, ESLint, Prettier and 2,362 Jest tests pass.
* Pull request: opened after #246 is merged into `develop`, because the code imports its two functions.

## Decisions and problems

* Self-installation in `index.ts` instead of a call from `src/app`: it is the pattern of the other modules and does not touch M0's files.
* M8's sources depend on #246. The pull request waits for it rather than shipping empty goals that would change later.

* Metas and Billetera do not read the params "Programar" and "Revisar" send yet (goal and amount, low use filter): ask Karol (M8, M9) for a payday reminder entry point and the low use filter.

## Next step

Open the pull request when #246 is in `develop`. Then finish M15 (#248 and the Inversión tab).
