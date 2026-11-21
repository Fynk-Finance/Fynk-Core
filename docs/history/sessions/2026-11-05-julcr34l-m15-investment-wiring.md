---
date: 2026-11-05
developer: Julián Castiblanco
github: JulCR34l
module: M15
jira: [SCRUM-66]
branch: feature/investment-tab-v2
tool: Claude Code
pr: none
status: done
---

# Install the Inversión tab with M6's CDTs, and keep the M10 and M11 wiring in M0

## Instruction

Julián asked to review the latest changes in `develop` and keep finishing his modules in order: "analiza las actualizaciones y comencemos a terminar módulos y tareas".

## What was done

* Analysis of `develop`: #246 (M8's goals for M10) merged; #248 (market backend) approved by Juan Carlos; #261 (Sofía, M0) configures M10 and M11 at app startup from `src/app/startup.ts`; #260 (Juan Carlos, M5) exposes Banco Demo's CDT catalog to M15 through `bank/ports.ProductsOf`.
* #261 does the same as the local branch `feature/analytics-wiring` (M10 and M11 installing themselves from their `index.ts`). Julián approved #261 and the local branch is not used, so the modules are not installed twice.
* Rebased `feature/market-backend-v2` and `feature/investment-tab-v2` on `develop` (12 new commits).
* `investment/domain/investment.ts`: `totalPerDay`, the daily total of the CDT balances from M6's balance of each account per day.
* `investment/index.ts`: the module installs itself with M6's `getCdtAccounts` and `getBalanceHistory`. "+ Invertir" opens `EXPO_PUBLIC_BANCO_DEMO_PORTAL_URL` + `/portal/actions`, `https://localhost:8082` (the local simulator) by default.
* Tests: `totalPerDay` and `investment/index.test.ts` (reads M6's CDTs and totals their balances per day; no history call without CDTs).

## Result

* Mobile: tsc, ESLint, Prettier and 2,455 Jest tests pass. Go (market): golangci-lint 0 issues, `go test -race` passes.
* Pull request: opened after #248 is merged.

## Decisions and problems

* M15 installs itself in its own `index.ts` instead of in `src/app/startup.ts`, so M0's files are not touched.
* `EXPO_PUBLIC_BANCO_DEMO_PORTAL_URL` is not in `apps/mobile/.env.example` (M0's file): ask Sofía to add it.

## Next step

Open the Inversión pull request when #248 is in `develop`. When #260 is merged, switch the market catalog to `bankports.ProductsOf("banco-demo")` and delete `catalog.BankDemoProducts`.
