---
date: 2026-11-06
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-28]
branch: feature/dashboard-statistics-link
tool: Claude Code
pr: none
status: done
---

# Open Estadísticas from the Dashboard chart icon

## Instruction

Sofia asked to finish the missing link between the Dashboard and Estadísticas: "There is a missing part, the link between dashboard and stadistics. Complete this task. It is part of M6". M10 built Estadísticas (#274, #280) and left the Dashboard chart icon to M6 (`STATISTICS_ROUTE`).

## What was done

* `apps/mobile/src/modules/accounts/ui/DashboardScreen.tsx`: new dependency `statisticsRoute`. The header's chart icon pushes it (`onPressStatistics` of `HeaderBlue`, added in the shared pull request below this one).
* `apps/mobile/src/modules/accounts/index.ts`: passes M10's `STATISTICS_ROUTE` (`analytics.Spending`, path `analisis`). The file already imported `useMonthSummary` from `@modules/analytics`, so no new import cycle.
* `DashboardScreen.test.tsx`: pressing "Estadísticas" arrives at `analytics.Spending`, and the button is there in the dark theme.

## Result

* Tests: 2,625 of 2,625 in the app, 122 snapshots unchanged. Typecheck, ESLint and Prettier clean.
* Pull request: not opened yet, stacked on `feature/header-statistics-button`.

## Decisions and problems

* Chart icon only, as in the design (inventory row 5). The Gastos pill is not a button in the design, so it stays as it is.
* Estadísticas is a pushed screen with the default transition and back gesture, so nothing changes in navigation.

## Next step

Take screenshots on a phone next to `docs/design/screens/light/Dashboard.png` and the dark one, and check that the back gesture returns from Estadísticas to the Dashboard.
