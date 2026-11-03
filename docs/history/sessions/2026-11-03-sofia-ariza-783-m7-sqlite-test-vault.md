---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-31]
branch: test/transactions-sqlite-test-vault
tool: Claude Code
pr: none
status: done
---

# A node:sqlite test vault for M7, bottom of the M7 stack

## Instruction

Sofia pasted the full M7 prompt (movement list, filters, search, categories, manual movements) and chose, after planning: "Whole module as a stack", "Follow the design" and build the missing sheets "from components". This branch is the first piece of that stack.

## What was done

* `apps/mobile/src/modules/transactions/testing/nodeSqliteVault.ts`: a `VaultDb` for tests on Node's own SQLite (`node:sqlite`), with the same migration rules as the shared test vault (table prefix per module, versions tracked per module, one transaction at a time).
* Three tests: FTS5 with `unicode61 remove_diacritics 2` finds "Café Señor" with `"senor"*`, a failed transaction rolls back, and a table without the `transactions_` prefix is refused.

## Result

* Tests: 3 of 3. Lint, typecheck and Prettier clean on the module.
* Pull request: in the M7 stack, bottom.

## Decisions and problems

* The shared test vault uses sql.js, which has FTS3 and FTS4 but not FTS5 (`no such module: fts5`). The phone (op-sqlite with SQLCipher) has FTS5 only. So the search index of M7 can only be tested on an SQLite that has FTS5. Node 22.20 (CI and local) has it, with accent folding.
* Jest does not know `node:sqlite` as a module, so the file loads it with `process.getBuiltinModule`.
* It stays inside M7. Moving it to `shared/testing` for other modules is an M0 follow-up.

## Next step

`feature/transactions-store-and-pagination`: the vault tables and the store on top of this vault.
