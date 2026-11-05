---
date: 2026-11-05
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-71, SCRUM-28]
branch: feature/dashboard-month-summary-and-cash-backup
tool: Claude Code
pr: "#262"
status: done
---

# Back up cash with M2 and take the Dashboard's Ingresos and Gastos from M10

## Instruction

Sofia asked to finish two pending M6 items in one plan: "Cash isn't backed up: it still uses a no-op markDirty and never calls registerBackupCollection, even though M2 now exports both" and "The Dashboard's Ingresos/Gastos card uses a temporary summary that always shows $0. It switches to M10's useMonthSummary once M0 configures analytics".

## What was done

* One branch, stacked on #261 (M0 configures M10 at startup), because without #261 M10's hook stays `unavailable` and the card would never get numbers.
* Cash backup (SCRUM-71), commit 1:
  * `modules/accounts/index.ts` takes `markDirty` and `registerBackupCollection` from `@modules/vault` and registers `accounts.cash` when the module loads. The no-op `markDirty`, the `TODO(M2)` and the `cashBackupCollection` export (nobody imported it) are gone.
  * `modules/accounts/index.test.ts` (new, written first), 3 tests on a real SQLite vault with the in-memory backup registry: `accounts.cash` is registered once; `setCash` marks the cash account and its history entry dirty; an export followed by a restore brings the cash back.
* Ingresos and Gastos (SCRUM-28), commit 2:
  * `application/useMonthSummary.ts` (new): `createUseMonthSummary` turns M10's `useMonthSummary()` into the card's `{ incomeMinor, spendingMinor }`, or `null` while M10 has no data.
  * `ui/DashboardBalanceCard.tsx`: each pill shows a `Skeleton` while the summary is `null`, like the balance total, instead of a made-up $0.
  * `domain/dashboard.ts`: the temporary `monthSummary` and its 2 tests are removed. M6 keeps only the `MonthSummary` type.
  * Tests written first: `useMonthSummary.test.ts` (2: maps M10's numbers, null while loading) and a new Dashboard case (placeholders, not $0, while loading).

No file outside M6 was edited.

## Result

* Tests: full mobile suite 210 suites, 2440 tests pass. `tsc --noEmit`, ESLint and Prettier pass. The first commit passes the M6 tests on its own too.
* Pull request: #262, stacked on #261 (stack #263).
* Not checked on a phone yet.

## Decisions and problems

* Stacked on #261 instead of branching from `develop`: the code compiles on `develop`, but the Dashboard only shows real numbers once M0 configures M10.
* Loading shows a skeleton, not $0. A $0 while loading would look like a real month without income or spending.
* An error from M10 also leaves the skeleton, the same as the balance total when the accounts fail. The Dashboard's retry button covers the accounts only.
* `git fetch` needs `-c http.sslBackend=schannel` on this machine (same as #261).

## Next step

Daniel (M2) and Julián (M10) can check the use of their ports in review. Merge #261 first, then this pull request. Still pending in M6: the name of onboarding in "Hola, <nombre>" (`TODO(M3)`) and pull to refresh with M5's sync (`TODO(M5)`).
