---
date: 2026-11-09
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-84]
branch: feature/statistics-button-all-tabs
tool: Claude Code
pr: none
status: done
---

# Estadísticas, the bell and the avatar on every tab (QA review V9)

## Instruction

Part of "Lets fix all the visual problems at once", every pull request in one stack. V9: the Estadísticas button, like the bell, must be in all 4 tabs. While planning, Recomendaciones and Inversión turned out to show a bell and an avatar that did nothing; Sofia chose "Yes, wire them too".

## What was done

* `modules/recurring` (M9): Billetera gets a `statisticsRoute` dependency and the chart button; `index.ts` passes M10's `STATISTICS_ROUTE`.
* `modules/recommendations` (M11): `RecommendationsNavigation` gains `useUnreadCount` and the account, notifications and statistics routes; `index.ts` wires M12's `useUnreadCount` and `NOTIFICATIONS_ROUTE` and M10's `STATISTICS_ROUTE`. The header shows the unread dot and its three buttons work.
* `modules/investment` (M15): `createInvestmentScreen` takes an `InvestmentHeader` (name, unread count, routes) instead of only the name; `index.ts` wires the same modules.
* `shared/ui/components/HeaderBlue.tsx`: comments say every tab has the chart button.
* Tests: each of the three tabs opens Estadísticas from the chart; Recomendaciones and Inversión also show the unread dot and open Notificaciones and Mi cuenta.
* `docs/design/README.md`: the inventory rows of Billetera, Recomendaciones and Inversión list the header buttons.

## Result

* Tests: 2730 of 2730. Typecheck and ESLint clean.
* Pull request: not opened yet (opened with the whole stack). Karol (M9) and Julián (M11, M15) approve.

## Decisions and problems

* Nothing imports M11 or M15, so they import M10 and M12 directly with no cycle.
* The tab of M11 reads the routes through getters, so `configureRecommendations()` can still override them, like the other targets.

## Next step

V6: a ghost card in Billetera when there are no fixed expenses.
