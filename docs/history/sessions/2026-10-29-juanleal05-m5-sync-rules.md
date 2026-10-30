---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-24, SCRUM-25]
branch: feature/sync-rules
tool: Claude Code
pr: none
status: done
---

# The sync rules and the mapping to Account and Transaction

## Instruction

The developer asked to push step 3 and "After that, start with C" (M5 step 4, the sync engine). First layer: the pure rules, with an injected clock.

## What was done

* `domain/syncRules.ts`:
  * `canStartSync`: 60 s per link, counted from the last start; a clock that went back never locks a link;
  * `shouldSyncOnForeground`: 15 minutes or more in the background;
  * `syncSince`: 12 calendar months back on the first sync (29 February goes to 28 February), else 3 days before the last sync;
  * `needsRefresh`: less than 60 s left on the access token.
* `domain/syncMapping.ts`:
  * `toAccount` and `toTransaction` map the bank's shapes to the shared `Account` and `Transaction` (contracts, section 2);
  * `accountIdOf` and `transactionIdOf` derive stable ids from the bank's own ids (SHA-256, length-prefixed parts);
  * movements get `merchantKey` with `normalizeMerchant`, and stay as `other` with `categorySource: 'rule'` for M7;
  * an unknown provider is refused.
* Tests: 10 for the rules, 7 for the mapping.

## Result

* Tests: bank 15 suites, 100 tests. Typecheck and ESLint pass.
* Pull request: not opened yet. About 330 lines.

## Decisions and problems

* **Stable ids:** M6's `upsertFromSync` keeps the id of the first row it sees for each `(provider, providerAccountId)`. If M5 made a new id on each sync, movements would point to an account id M6 never stored. Deriving the id from the bank's ids avoids that, and gives M7 the same movement id on the 3-day overlap.
* **"After 15 minutes" means 15 minutes in the background.** The prompt says "AppState back to active after 15 minutes", which could also mean since the last sync. The 60 s cooldown still applies on top. To confirm with the team if they meant otherwise.
* **12 months are calendar months,** not 365 days.

## Next step

`feature/mobile-sync-engine`.
