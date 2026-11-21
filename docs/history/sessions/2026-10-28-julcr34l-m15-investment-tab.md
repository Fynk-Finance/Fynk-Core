---
date: 2026-10-28
developer: Julián Castiblanco
github: JulCR34l
tool: Claude Code
pr: none
status: done
module: M15
jira: [SCRUM-66]
branch: feature/investment-tab
---

# Inversión tab

## Instruction

Julián asked Claude (claude.ai, Fynk project, session linked to the repository zip): "soy la persona 6, que hace la parte de analytics AI and investment, ayúdame a realizarlo con la información que hay en el repo y con respecto al módulo". Claude followed `docs/modules/M10-analytics.md`, `M11-recommendations.md` and `M15-investment.md`, `00-shared-contracts.md` and the design sources, and built the three modules as one stack of branches.

## What was done

* `modules/investment/domain`: compound E.A. calculator rounded down to the peso, own CDTs from M6 accounts, total, interest of the year, rate weighted by amount, next maturity, chart periods, `exploreCatalog(products, filters, sort)` that cannot receive a balance.
* Screen: header with the total and the chart, tiles (no "Aporte mensual"), "Tus inversiones" with "+ Invertir" to the Banco Demo portal, Explorar (CDT and Acciones, term, risk and order chosen by the person, default by name, "Simulado" badge), the calculator, the Banrep reference box and the disclaimer.
* `configureInvestment({ accounts, clock, bancoDemoPortalUrl })`.

## Result

* 20 tests pass, including $50.471, the same Explorar list for two very different balances, the amount never prefilled, and the scan of the copy for "recomendado", "ideal para ti", "te conviene", "según tu perfil", "puedes invertir", "deberías" and "mejor opción".
* The whole mobile suite passes (712 tests); tsc, ESLint and Prettier clean.

## Decisions and problems

* M6's `getCdtAccounts()` and balance history do not exist yet; they come in through `AccountsPort`. Without history the chart is hidden.

## Next step

* Wire `configureAnalytics`, `configureRecommendations` and `configureInvestment` at startup with M0 and M2, once M2, M6, M7, M8, M9 and M12 export their functions.
