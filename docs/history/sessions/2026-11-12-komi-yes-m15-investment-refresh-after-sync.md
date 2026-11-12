---
date: 2026-11-12
developer: Daniel Palacios
github: Komi-yes
module: M15
jira: [SCRUM-66]
branch: fix/investment-refresh-after-sync
tool: Claude Code
pr: "#381"
status: done
---

# Inversión reloads its CDTs after a pull to refresh on Inicio

## Instruction

While testing CDTs opened in the Banco Demo portal, the developer asked that the Inversión tab update with the refresh on Inicio, not only by reopening the app: "the refresh from inicio should also update the inversion tab it should update differently and less by closing the app and opening it again".

## What was done

* Cause: `useOwnCdts` in `application/hooks.ts` read the CDTs once, when the tab first rendered. Tabs stay mounted, and nothing reloaded that query after a sync, so a new CDT showed only after reopening the app.
* `application/ports.ts`: `AccountsPort` gets an optional `subscribe(onChange)`, called when the accounts may have changed.
* `index.ts`: `cdtAccounts.subscribe` listens to `sync.completed`, `vault.unlocked` and `vault.locked` on the shared app events.
* `application/hooks.ts`: `useOwnCdts` subscribes and reloads the own CDTs query on each signal, as `useAccounts` of M6 does for Inicio.
* Tests: `ui/InvestmentScreen.test.tsx` (a CDT that arrives after the signal is shown without reopening the app) and `index.test.tsx` (the signal fires on sync, unlock and lock, not on other events, and stops after unsubscribing). Both failed before the change.

## Result

* Tests: the 32 tests of the investment module pass. `tsc`, ESLint and Prettier are clean.
* Pull request: #381.
* Works: pulling to refresh on Inicio (or any sync) now also updates the CDT list and total of Inversión.

## Decisions and problems

* The change stays inside M15: it uses the shared app events instead of a new export of M6 or a change to `app/startup.ts` (M0).
* M15 is owned by `@JulCR34l`, so the pull request needs that approval.
* The CDT only arrives if the sync itself works. The same session found that bank links stay dead after the simulator restarts (see `2026-11-12-komi-yes-m16-portal-login.md`).

## Next step

Try it on the phone with the simulator fixes of `fix/banco-demo-portal-login`, then open the pull request.
