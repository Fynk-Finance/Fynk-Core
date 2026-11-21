---
date: 2026-11-20
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-26]
branch: fix/dashboard-income-spending-pills
tool: Claude Code
pr: "#446"
status: done
---

# Make the Ingresos and Gastos pills of the Dashboard show and open the last 30 days

## Instruction

Sofia said the Ingresos and Gastos arrows of the Dashboard card did nothing: "Corrígelo para que no sean meramente
estéticos y muestren los ingresos o gastos registrados de los últimos 30 días".

## What was done

* Found that the pills were plain views that could not be tapped, and that their amounts came from M10's summary of
  the calendar month, not of the last 30 days.
* M7 `domain/filter.ts`: new pure `recentFilter(now, kind?)` with `RECENT_DAYS = 30`, the last 30 Bogotá days with
  today included. `index.ts` now exports it and the existing `useTransactionSummary` hook.
* M6 `application/useRecentSummary.ts` (replaces `useMonthSummary.ts`): reads M7's summary of that filter, gives Gastos
  as a positive amount and `null` while loading. `domain/dashboard.ts`: `MonthSummary` renamed `RecentSummary`.
* M6 `ui/DashboardBalanceCard.tsx`: each pill is a button. A tap opens Movimientos with
  `{ filter: { kind, from, to } }`. The label read by screen readers is "Ingresos de los últimos 30 días: $X" (and
  Gastos), with a hint. The visible text stays as in the design.
* M6 `ui/DashboardScreen.tsx` and `index.ts`: new deps `useRecentSummary`, `transactionsRoute` and `recentFilter`. M6
  no longer reads M10's month summary. M10 is unchanged.
* Tests: `recentFilter` (30 days, kind, Bogotá day at the edge of UTC, year change), `useRecentSummary` (asks M7 with
  the filter, positive Gastos, null while loading), and the Dashboard (amounts, labels, and both pills opening
  Movimientos with their kind and dates).

## Result

* Tests: the whole mobile suite passes, 252 suites and 2958 tests. `tsc`, ESLint and Prettier pass on the changed
  files.
* Pull request: #446.
* Not yet checked by hand on a device.

## Decisions and problems

* Sofia chose to count everything registered (M7's sum of money in and out), so the pill and the "+$X · −$Y" line of
  Movimientos always match. M10's rule leaves out transfers between own accounts, card payments and savings, which the
  type filter of Movimientos does not; following it would have needed a change in M10, owned by another person.
* Movimientos opens with 2 active filters (dates and type), which the person can clear from Filtros.
* Tapping a pill is new behavior that is not in the design, so it needs design review.

## Next step

Check it on a device in light and dark: register an Ingreso and a Gasto with the FAB, see the pills update, and tap
each one. Then ask for review of #446.
