---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-31]
branch: feature/transaction-search-fts
tool: Claude Code
pr: none
status: done
---

# Search of Movimientos with FTS5

## Instruction

Same session as the M7 stack. Work plan step 3: "FTS5 index, triggers to keep it in sync, search bar". HU-017: "Coincidencias parciales, respuesta rápida, sin distinguir mayúsculas y minúsculas, resultados relevantes". Test: "SUPERMERC" and "supermércado" both find "Supermercado".

## What was done

* `adapters/vault/migrations.ts` v2:
  * `transactions_fts` (FTS5, `content=` the movements table, `unicode61 remove_diacritics 2`).
  * Insert, update and delete triggers.
  * A `rebuild` for movements saved before the index.
* `domain/searchQuery.ts`: each typed word becomes a quoted prefix (`"super"*`), so FTS5 syntax typed by the person is plain text; at most 8 words.
* The search joins the filters (`t.rowid IN (SELECT rowid FROM transactions_fts WHERE ... MATCH ?)`) on the keyset pages and the summary.
* `searchTransactions(text)` in `index.ts`: at most 50, newest first.
* Movimientos: "Buscar por nombre" (shared `SearchField`) next to "Filtros". It runs 250 ms after the person stops typing and shows "No encontramos movimientos" when nothing matches.
* Tests:
  * "SUPERMERC" and "supermércado" find "Supermercado".
  * Partial words in description or merchant; every word needed; syntax as text.
  * Search plus filters; the index follows updates and deletes; old rows indexed by the rebuild.
  * 3.000 movements answer in under 300 ms.
  * The screen searches as the person types.

## Result

* Tests: 2221 of 2221 in the app. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the Filtros sheet.

## Decisions and problems

* Results are ordered newest first, like the rest of the list. Every word must match, so results stay relevant without a rank.
* The phone's SQLCipher is built with FTS5 (`"op-sqlite": { "fts5": true }`); the tests run on node:sqlite, which has FTS5 too.
* An external content index refers to `rowid`. If M2 ever runs `VACUUM` on the vault, `INSERT INTO transactions_fts (transactions_fts) VALUES ('rebuild')` has to run after it.
* A debounced search in Jest needs the debounce timer to run inside `act`; outside it, React kept the update until the end of the test. The test helper waits inside `act`.
* Gate C asks for under 300 ms on a mid range Android phone. The Jest check runs on a laptop; the phone check stays for Sofia once sync brings 12 months of data.

## Next step

`feature/transaction-categorization`: the categorization pipeline and its rules.
