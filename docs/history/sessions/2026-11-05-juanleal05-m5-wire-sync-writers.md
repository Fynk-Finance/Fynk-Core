---
date: 2026-11-05
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-24, SCRUM-25, SCRUM-22, SCRUM-23]
branch: feature/wire-sync-writers
tool: Claude Code
pr: none
status: done
---

# Switch the phone sync on with the M6 and M7 writers

## Instruction

Juan Carlos asked to continue M4 and M5 from the handoff, in the recommended order, starting with wiring the sync: "let's work in the order you proposed ... At the end of each part, you need to tell me wether I can close a User Storie or not, the whole idea is to be able to close them all."

## What was done

* `apps/mobile/src/modules/bank/index.ts`: builds the sync engine with M6's `upsertFromSync` and `markLinkRevoked` and M7's `upsertFromSync` and gives it to the sync controller instead of `null`. Other modules are used only inside functions, because M7 imports `@modules/bank` and the three modules form an import cycle.
* A new link starts its first sync (12 months) as soon as the bank returns the tokens (`application/firstSync.ts`). If a sync that started before the link was already running, it asks once more.
* A consent revoked from the app now also calls M6's `markLinkRevoked` for each link it ends, so the accounts show as revoked without waiting for a sync.
* `application/syncController.ts`: `start()` read the links synchronously while the app loads, before the vault is unlocked, so `VaultLockedError` escaped the promise chain. It was harmless while the engine was `null` (start returned early); with the engine wired it would have crashed the app on open. The read now starts inside a promise.
* Tests: `index.test.ts` (a sync writes through M6 and M7, emits `sync.completed`, sends the M12 notice and sets the last update date; revoke tells M6), `loadOrder.test.ts` (M5, M6 and M7 load in three orders with real modules), `firstSync.test.ts` (3 cases), and a controller test for the locked vault.

## Result

* Tests: the whole mobile suite passes (205 suites, 2420 tests). `tsc`, ESLint and Prettier pass on the module.
* Pull request: not opened yet.
* Works: `syncNow()` (Movimientos pull to refresh), opening the app and returning after 15 minutes now sync every active link. Not checked on a phone or against Banco Demo: its authorization page does not exist yet (M16).

## Decisions and problems

* The first sync runs without blocking the link result screen: its result arrives through `useSync` and the M12 notice.
* The load-order test found the locked vault crash before it reached a phone.
* Dashboard (M6, Sofia) has a `TODO(M5)` for pull to refresh and Billetera (M9, Karol) has none. Both can now call `syncNow()`; this is told to them in the pull request, not changed in their code.

## Next step

Push and open the pull request after Juan Carlos reviews this log, then test `ConsentsRevoker.RevokeAll` in M4.
