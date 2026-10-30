---
date: 2026-10-29
developer: Juan Carlos Leal
github: JuanLeal05
module: M5
jira: [SCRUM-23, SCRUM-22]
branch: feature/bank-vault-tables
tool: Claude Code
pr: none
status: done
---

# Keep bank links and tokens in the phone's vault

## Instruction

Second part of step B, which the developer approved ("Yes, push and do B"): the `bank_links` and `bank_tokens` vault tables, a small store, and the subscription to M4's `onConsentRevoked` that deletes a revoked link's tokens.

## What was done

* `domain/link.ts`: `NewBankLink`, `BankLink` (status, `lastSyncedAt`, `lastAttemptAt`, `revokedAt`) and `BankTokens`.
* `adapters/vault/migrations.ts`: version 1 with `bank_links` (one link per consent, `consent_id` unique) and `bank_tokens` (one row per link). Registered with `registerVaultMigrations('bank', …)`.
* `adapters/vault/vaultLinkStore.ts` with the `LinkStore` port:
  * `saveLink` writes the link and its tokens in one transaction;
  * `getLinks` never returns tokens;
  * `getTokens` returns only an active link's tokens;
  * `updateTokens` ignores a revoked link;
  * `revokeLink` and `revokeByConsent` keep the first revoke date and delete the tokens in the same transaction.
* `application/linkRevocation.ts`: on M4's event, revokes the consent's links, at the API's time or else the clock's.
* `index.ts`: registers the tables, subscribes to `onConsentRevoked`, and exports `getLinks()` and the `BankLink` type.
* Tests:
  * the store on a real SQLite vault (sql.js), 8 tests;
  * the handler, 3 tests;
  * `index.test.ts`: the wiring end to end on the in-memory vault, plus a source check that no M5 file registers a backup collection.

## Result

* Tests: bank 7 suites, 34 tests. Full mobile suite 114 suites, 1,370 tests. Typecheck and ESLint pass.
* Pull request: not opened yet. About 480 lines, about half of them tests.
* The phone side of HU-008's "Sin nuevas sincronizaciones" now works for links. Nothing creates a link yet (step B4 does).

## Decisions and problems

* **`last_attempt_at` is in the table now,** so step 4's 60 second cooldown needs no second migration. It counts from the start of a sync, finished or not.
* **A locked vault makes the listener fail,** and M4 already ignores listener errors. The next sync gets `409 consent_revoked` from the backend and revokes the link then (step 4).
* **M6's `markLinkRevoked` is not called yet:** M6's stack (#164 → #167) isn't merged. Step 4 calls it when M6 lands.
* **Tokens are stored as vault text.** The vault is SQLCipher, so they're encrypted at rest. They're never logged and never backed up.

## Next step

`feature/bank-link-api-and-pkce`.
