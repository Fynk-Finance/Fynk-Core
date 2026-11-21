---
date: 2026-10-29
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M6
jira: [SCRUM-26, SCRUM-27, SCRUM-28]
branch: feature/accounts-vault-and-sync-api
tool: Claude Code
pr: none
status: done
---

# Accounts in the vault, the write API for M5 and the read API

## Instruction

Second part of the first M6 work plan step: "tables, write API for M5". Same session as `2026-10-29-sofia-ariza-783-m6-net-worth.md`, split in its own stacked branch to keep each pull request small.

## What was done

* `adapters/vault/migrations.ts`: `accounts_accounts` with every `Account` field, a unique index on `(provider, provider_account_id)` (no duplicates), a unique index that allows a single cash account, and `accounts_balance_history (account_id, on_date, balance_minor)`.
* `adapters/vault/vaultAccountsStore.ts`: upsert by `(provider, provider_account_id)` that keeps the first id, so an account linked again keeps its history; one balance point per account per day in Bogotá, the last sync of the day wins.
* `application/accountsService.ts`: `upsertFromSync`, `markLinkRevoked`, `getOverview`, `getAccounts`, `getBalanceTotal`, `getConnectedAccountsSummary`, `getCdtAccounts`, `getBalanceHistory`, and a change listener.
* `application/useAccounts.ts`: TanStack Query under `['accounts']`, refetched only when the service reports a change. While the vault is locked it reads as empty.
* `index.ts`: registers the vault migrations, listens to `sync.completed`, `vault.unlocked` and `vault.locked`, and exports the write and read API. The Dashboard tab is still M0's placeholder.
* 14 tests on a real SQLite vault (sql.js) and on the hook.

## Result

* Tests: 45 of 45 in the module, 1087 of 1087 in the app. Lint and typecheck clean.
* Pull request: second in the M6 stack.

## Decisions and problems

* A whole sync is validated before anything is written, so a malformed account never leaves half a sync in the vault.
* Revoked accounts stay in the vault with status `revoked` and leave every list and total. A new link to the same bank brings them back with the same id.
* The query has no time based staleness: data changes only through sync, unlock, lock or a write, which all notify the hook (CLAUDE.md rule 4).

## Next step

Cash account, its history, the `accounts.cash` backup collection and `CashInput`.
