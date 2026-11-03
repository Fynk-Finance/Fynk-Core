---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-29]
branch: feature/transactions-store-and-pagination
tool: Claude Code
pr: "#230"
status: done
---

# Movements store, keyset pagination and the functions other modules wait for

## Instruction

Same session as `test/transactions-sqlite-test-vault`: the M7 prompt, built as one stack. This branch is work plan step 1 without the screens: "tables, keyset pagination".

## What was done

* `adapters/vault/migrations.ts` (v1): `transactions_transactions` as in the prompt, plus `backup_version` for manual rows, the category change history, the merchant overrides and a table of overrides for single bank movements (by `providerTxId`, so a new phone applies them again after its first sync).
* `adapters/vault/vaultTransactionsStore.ts`: upsert by `(account_id, provider_tx_id)` that keeps the category and the goal, deletes pending movements the bank no longer returns, keyset pages on `(booked_at, id)` and lists by UTC range.
* `domain/bogota.ts` (Bogotá days to UTC bounds), `domain/query.ts` (filter, cursor, pages of 20), `domain/syncedTransactions.ts` (checks what M5 hands over).
* `index.ts` exports `upsertFromSync` (M5's `TransactionsSink`), `queryTransactions`, `getTransactionsBetween` (M9, M10), `getTransaction` and `setTransactionGoal` (M8).
* Tests: 21 new, on node:sqlite. Among them: paging never repeats or skips a row when a sync lands between two pages, Bogotá day bounds at 05:00 UTC, and a malformed movement writes nothing.

## Result

* Tests: 2166 of 2166 in the app before this log. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the test vault.
* The routes still show M0's placeholder; the Movimientos screen comes next.

## Decisions and problems

* The function for M5 is `upsertFromSync({ accountId, since, transactions })`, exactly the `TransactionsSink` that M5 already codes against. It is not in the M7 prompt's export list. M5 still has to pass it to its sync engine (`bank/index.ts`, `engine: null`).
* A movement synced again keeps the id it had first, its category and its goal: the bank owns what happened, the person owns the category.
* `booked_at` is stored as UTC with milliseconds, so text order is time order and the keyset compare is right.
* The PR is about 850 lines, roughly 40 % tests. The store and its tests are kept together.
* `getTransactionsBetween` takes Bogotá days, both included, as M10's `listTransactions` port expects.

## Next step

`feature/transactions-list-screen`: the Movimientos screen of the design with "Cargar 20 más" and pull to refresh.
