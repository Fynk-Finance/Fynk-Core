---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-25, SCRUM-24]
branch: feature/sync-triggers-and-feedback
tool: Claude Code
pr: none
status: partial
---

# The sync triggers, useSync and the daily notice

## Instruction

Third layer of step C ("After that, start with C"): sync on `vault.unlocked`, on `AppState` active after 15 minutes, and on pull to refresh through `syncNow()`, with `useSync()` for the screens and the M12 notice once per day. No timers, no background fetch.

## What was done

* `application/syncController.ts`:
  * the triggers: vault unlocked, and back to `active` after 15 minutes or more in `background` (`inactive` alone doesn't count);
  * `syncNow()` (calls made during a run share it);
  * a state with `status`, `lastSyncedAt` (latest among the active links) and `lastReport`;
  * the M12 notice per synced link, with the dedupe key `sync_result:<link>:<Bogotá day>` and the deep link `fynk://billetera`. A notice that fails never undoes a sync.
* `application/useSync.ts`: `useSync()` over the controller (`useSyncExternalStore`).
* `domain/syncRules.ts`: `bogotaDay`.
* `strings.es-CO.ts`: "<Entidad> sincronizada", "Tus movimientos están al día." (M5 prompt).
* `index.ts`: exports `syncNow`, `useSync` and the `SyncReport` types; starts the triggers on `appEvents` and `AppState`; the entity names come from `GET /providers`, kept in memory.
* Tests: 9 for the controller, plus 1 in `index.test.ts`. They cover:
  * the unlock;
  * 15 minutes in the background, not before;
  * stopping;
  * the syncing and idle states with the last date;
  * one notice per day (Bogotá day at 23:30);
  * no notice on failure or cooldown;
  * a notice failure;
  * no engine, so no bank calls.

## Result

* Tests: full mobile suite 124 suites, 1,459 tests. Typecheck and ESLint pass.
* Pull request: not opened yet. About 390 lines.
* **Status partial:** the engine isn't wired. `syncNow()` answers `unavailable` until M6's `upsertFromSync` and M7's writer are on `develop`. A last small layer will pass them to the engine; then HU-010 and HU-011 work end to end.

## Decisions and problems

* **No engine until M6 and M7 can write.** Syncing without them would call the bank and throw the data away, against the API limits. M6 and M7 can already call `syncNow()` from pull to refresh.
* **No toast.** The M5 prompt asks for "a small toast", but there's no shared `Toast` in `@shared/ui`, and the design README says to export the toast open before building one (M0, Sofia). `useSync().lastReport` has the result, ready for when it exists.
* **"Reconecta <Entidad>" goes on M6's account card.** M5 marks the link revoked and calls `markLinkRevoked`; M6 draws the card.

## Next step

When M6's stack (#164 → #167) merges and M7 has its writer: a small layer that passes them to the engine in `index.ts`. Then run Gate B on staging with Banco Demo (needs M16's authorization page and M14's settings).
