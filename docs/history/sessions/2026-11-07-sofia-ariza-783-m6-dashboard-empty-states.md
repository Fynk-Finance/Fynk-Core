---
date: 2026-11-07
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-77, SCRUM-80]
branch: feature/dashboard-empty-states
tool: Claude Code
pr: "#336"
status: done
---

# Planes de ahorro on the Dashboard and ghost cards for no goals and no accounts (QA review V2, V5)

## Instruction

Sofia asked to fix the Dashboard findings of the 7 Nov app review (#332): "In pr #332 theer are several visual and gestual changes, lets solve them. Most af them are small changes, lets start for Dashboard screen changes." This session covers V2 (the Dashboard has no savings goals section; show it, with a skeleton when there are no goals) and V5 (with no accounts, show a skeleton of the account card with a button to connect one).

## What was done

* V2: `accounts/ui/DashboardScreen.tsx` takes `renderGoals` and shows it above Movimientos; `accounts/index.ts` passes M8's `GoalsCarousel`. In `savings/ui/GoalsCarousel.tsx` the empty card is now a full-width `GhostCard` (112 high, radius 18) with "Crear meta", which opens the new goal form. Strings `create` and `none` replace `emptyTitle` and `emptyMessage` of the carousel.
* V5: while no bank account is connected (cash and CDTs do not count), Detalle de cuentas ends with a blue `GhostCard` "Conectar cuenta" and Mis cuentas (Billetera and Mi cuenta) ends with a ghost card the size of its cards, "Conectar". Both open M5's Conectar banco. The Dashboard reads `CONNECT_BANK_ROUTE` at press time.
* Tests: goals above movements, the ghost card and its button in the carousel (also when every goal is reached), the ghost card with no accounts, after cash, and gone once an account is connected, in the panel and in both Mis cuentas.
* `docs/design/README.md`: inventory rows 5 and 9 list the new empty states.

## Result

* Tests: 2,673 of 2,673 in the app, 128 snapshots. Typecheck, ESLint and Prettier clean.
* Pull request: #336, in stack #337 on top of #335. Stacked on the GhostCard pull request.

## Decisions and problems

* Importing `@modules/savings` from the accounts entry closes a cycle (savings → transactions → accounts), so the carousel is created only when the screen renders, like M7's preview. The accounts index test mocks savings.
* Reading `CONNECT_BANK_ROUTE` when the accounts module loads broke `bank/loadOrder.test.ts` (M5 loads first), so it is read on the press, like M7's route.
* The ghost card shows while no bank account is connected, not only with zero accounts: with only cash the person still has nothing to connect from.
* The Mis cuentas card is 162 px wide, so its button says "Conectar"; the panel has room for "Conectar cuenta".
* `modules/savings` changed, so Karol (M8) approves.

## Next step

Check both states on a phone, light and dark, then V10 and F5.
