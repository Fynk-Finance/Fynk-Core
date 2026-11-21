---
date: 2026-10-28
developer: Julián Castiblanco
github: JulCR34l
tool: Claude Code
pr: none
status: done
module: M10
jira: [SCRUM-60, SCRUM-35, SCRUM-36, SCRUM-37]
branch: feature/spending-caps
---

# Spending caps, the analytics screens and the module wiring

## Instruction

Julián asked Claude (claude.ai, Fynk project, session linked to the repository zip): "soy la persona 6, que hace la parte de analytics AI and investment, ayúdame a realizarlo con la información que hay en el repo y con respecto al módulo". Claude followed `docs/modules/M10-analytics.md`, `M11-recommendations.md` and `M15-investment.md`, `00-shared-contracts.md` and the design sources, and built the three modules as one stack of branches.

## What was done

* Vault tables `analytics_caps`, `analytics_settings`, `analytics_cap_alerts` and the store, backup collection `analytics.caps` (caps and the "Antojos" threshold).
* `analyticsService`: caps CRUD, suggested cap (previous period rounded up to $10.000), alerts through M12 at 80 % and 100 % once per cap, period and level, evaluated on `sync.completed`, `transactions.changed` and `vault.unlocked`.
* Screens (new, need design review): Gastos por categoría with periods, donut and categories, Tendencias (3, 6, 12 months, line chart), Ingresos recurrentes, Topes and the cap form (prefilled from "Fijar tope").
* `index.ts`: `configureAnalytics(deps)` receives M2, M7, M8, M9 and M12 through ports; exports `getMonthSummary`, `buildSnapshot`, `getAnalyticsReport`, `getOpportunities`, `getRecurringIncome`, `getTreatsThreshold`, `openCapForm`, `useOpenCapForm`.

## Result

* 58 analytics tests pass, the app shell tests too.

## Decisions and problems

* M2, M7, M8, M9 and M12 have not exported their functions yet, so the module takes them through `configureAnalytics`. Until it is called, the screens show their empty state. Whoever wires the app (M0, with M2) calls it once at startup.
* A cap that jumps past 100 % sends only "reached" and records the 80 % alert too, so it never arrives late.
* Found in M0's `LineChart`: `EndDot` uses a hook but gifted-charts calls it as a function, so React warns about hook order when the number of points changes. The screen keys the chart to avoid it; M0 should render it as an element.

## Next step

* `feature/recommendations-screen`.
