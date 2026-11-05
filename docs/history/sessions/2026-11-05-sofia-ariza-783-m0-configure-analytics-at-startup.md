---
date: 2026-11-05
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M0
jira: [SCRUM-68]
branch: fix/configure-analytics-at-startup
tool: Claude Code
pr: none
status: done
---

# Configure M10 and M11 at app startup

## Instruction

Sofia asked to fix, in the module that owns it: "App startup never calls configureAnalytics(...), so M10's hooks report unavailable and M11 can't install". M10's session log of 28 Oct already said "Whoever wires the app (M0, with M2) calls it once at startup", so the fix lives in M0 (`src/app/`).

## What was done

* `apps/mobile/src/app/startup.ts` (new):
  * `analyticsSources`: M10's `AnalyticsSources` from M7 `getTransactionsBetween`, M9 `getSubscriptionsSummary` and `getFixedExpensesThisMonth`, M8 `getGoalsForSnapshot` and `getPaydayContribution`.
  * `startModules()`: runs once. Calls `configureAnalytics` with those sources, M2's vault and backup ports, M12's `notificationsPort`, `appEvents`, a clock and `randomUUID`. Then `configureRecommendations`, which reads M10's report.
  * `bindQueryClient(client)`: the QueryClient whose `['analytics']` cache M10 refreshes on sync, movement changes and unlock. Returns the unbind.
* `apps/mobile/src/app/AppRoot.tsx`: calls `startModules()` when the file loads, next to the linking, so the vault tables and the `analytics.caps` backup collection register before the vault can open. `AppRoot` binds its QueryClient in an effect.
* `apps/mobile/src/app/startup.test.ts` (new, written first), 5 tests: the sources point at M7, M8 and M9; `getMonthSummary` and `useMonthSummary` work (they reach M7's locked vault instead of "not configured" or `unavailable`); vault tables of `analytics` register before `recommendations`, plus the `analytics.caps` collection; a second call registers nothing; `transactions.changed` invalidates the bound client's analytics queries, and not after unbind.

No file of M10 or M11 was edited.

## Result

* Tests: full mobile suite 208 suites, 2436 tests pass. `tsc --noEmit`, ESLint on `src/app` and Prettier pass.
* Pull request: not opened yet.
* M10's screens (Análisis, Topes) and the hooks other modules use now get data once the vault opens. The Recomendaciones tab installs.
* Not checked on a phone yet.

## Decisions and problems

* The wiring is in a separate `startup.ts`, not in a module, because M10 imports nothing from M7/M8/M9 (M7 imports M10, so the reverse would add a cycle). `src/app/` is never imported by modules, so no new cycle.
* Registration runs at load and the QueryClient is bound in an effect, because AppRoot creates the client per mount but the vault tables must register only once.
* M11's `navigation` is not passed: M8's `openPaydayReminder` and an M1 display-name hook are not on `develop` yet, so M11 keeps its defaults.
* A test that spread the real M7 module inside `jest.mock` broke M7's import cycle with M5. The test uses the real M7 instead and checks that it reaches the locked vault.
* `git fetch` failed with an SSL certificate error, so the branch starts from the local `origin/develop` (d92339d, fetched earlier the same day). Rebase before opening the pull request.
* `tsc` failed in M11's `recommendationsApi.ts` until `make generate-ts` regenerated the local `schema.gen.ts` (it was from 29 Oct). Generated, not committed.

## Next step

Rebase on `origin/develop` and open the pull request, with Julián as reviewer for the use of M10 and M11. Then:
* M6: Ingresos and Gastos of the Dashboard can use `useMonthSummary()` (the `TODO(M10)`).
* M11 `navigation`: pass M8's `openPaydayReminder` and M1's name hook once they are exported.
