---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-24, SCRUM-25, SCRUM-22]
branch: feature/mobile-sync-engine
tool: Claude Code
pr: none
status: done
---

# The phone's sync engine

## Instruction

Second layer of step C ("After that, start with C"): for each active link, refresh if needed, read the accounts and each account's movements by cursor, write them through M6 and M7 with no duplicates on the 3-day overlap, emit `sync.completed` or `sync.failed`, and end the link on `409 consent_revoked`.

## What was done

* `application/syncEngine.ts`: `createSyncEngine(deps).syncAll()`. For each active link:
  * the 60 s cooldown, then `markAttempt`;
  * renew the access token if under 60 s are left (the new tokens are kept);
  * `POST /bank/accounts/query`, then each account's movements by cursor from `syncSince`;
  * accounts to M6 through `AccountsSink`, movements to M7 through `TransactionsSink`;
  * `markSynced`.
* Results per link: `synced`, `cooldown`, `revoked` or `failed`, with the API's code.
  * `consent_revoked` and `link_not_found` end the link on the phone: revoked, tokens deleted, M6's `markLinkRevoked`.
  * `rate_limited` stops asking for the remaining links.
  * Calls made during a run share it. A locked vault (`VaultLockedError`) does nothing.
* Events: `sync.failed` per failed or revoked link, and one `sync.completed` with the synced link ids, the new movement ids and the changed account ids.
* `application/ports.ts`: `AccountsSink` (M6's shape) and `TransactionsSink` (the writer M5 needs from M7). `LinkStore` gets `markAttempt` and `markSynced`.
* Tests: 12 for the engine on a real SQLite vault with fakes for the API, M6 and M7, plus 1 for the store marks. They cover:
  * 12 months first;
  * two pulls within 60 s make one network call;
  * a shared run;
  * the 3-day overlap gives no new ids;
  * cursor paging;
  * token renewal;
  * revocation (both codes);
  * a revoked link is never synced;
  * a failure keeps the last update date;
  * `rate_limited`;
  * a locked vault.

## Result

* Tests: bank 16 suites, 113 tests. Typecheck and ESLint pass.
* Pull request: not opened yet. About 500 lines, about 260 of them tests. Over the 400 guideline; the engine and its tests are kept together.
* Not wired yet: nothing calls the engine. The next layer adds the triggers.

## Decisions and problems

* **M7 has no writer for synced movements.** `TransactionsSink` is the shape M5 needs: upsert by `(accountId, providerTxId)`, delete the pending movements since `since` that the bank no longer returns, and return the new ids. Sofia (M7) decides whether M7 offers this or something else.
* **`refresh_token_mismatch` is a failure, not a revocation:** the link stays, and the person sees the error. If it keeps happening, they revoke and link again.
* **The movement count isn't audited on the backend** (`bank.sync` has `accounts_count` only). The phone knows the count, but the backend only sees pages. Left as it is.
* **The movements of every account type are asked for, CDTs too.** If Banco Demo answers with an error for a CDT, that link fails; to watch once the simulator runs end to end.

## Next step

`feature/sync-triggers-and-feedback`.
