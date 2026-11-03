---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-32]
branch: feature/transaction-categorization
tool: Claude Code
pr: "#237"
status: done
---

# Default categories for synced movements

## Instruction

Same session as the M7 stack. Work plan step 4, split in three (pipeline, changes, detail screen). HU-018: "Categorías predeterminadas". Test: "Categorization table tests in Spanish, at least 40 merchant strings from the demo fixture".

## What was done

* `domain/categorize.ts`: the pipeline, first match wins:
  1. The person's category for the bank movement.
  2. The person's category for the merchant.
  3. M9's catalog (optional).
  4. Keyword rules.
  5. Food under the Antojos threshold becomes `treats`.
  6. `other`.
* `domain/rules.es-CO.ts`: ordered keyword rules for Colombian merchants and bank descriptions (Éxito, D1, Ara, Uber, TransMilenio, Netflix, EPM, Claro, nómina, arriendo, droguerías, cine, gimnasio and more). They match whole words on text without accents or case.
* `application/transactionsService.ts`: `categorizeNew(ids)`.
  * Skips movements whose category the person picked.
  * Reads the overrides in one query each.
  * Writes only what changed and emits `transactions.changed`.
* Store: `getMany`, `overridesFor`, `setCategories`.
* `index.ts`: runs `categorizeNew` on `sync.completed` for the new ids, with `getTreatsThreshold()` from M10.
* Tests:
  * Table of 59 strings: the 21 distinct strings of `fixtures/demo-user.json` with the fixture's category, plus 38 Colombian merchants.
  * Pipeline order, the threshold, salary only for money in.
  * `categorizeNew` on the vault: new ids, threshold, the person's category kept, overrides by bank id and by merchant.

## Result

* Tests: 2292 of 2292 in the app. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the search.

## Decisions and problems

* The prompt asks for 40 merchant strings "from the demo fixture", but the fixture has only 21 distinct ones. The test uses all 21 and adds 38 common Colombian ones.
* Rule text is built by M7 (lowercase, no accents, signs as spaces), not with the shared `normalizeMerchant`, because that one drops digits and "D1" would become "d".
* "Food" for Antojos is Restaurantes and Mercado. In the fixture every café is under $20.000 and every restaurant and supermarket above it, so the fixture categories come out the same.
* `getCatalogCategory` of M9 is not on develop: step 3 is an optional dependency, marked `TODO(M9)` in `index.ts`.
* The categorization does not send any movement text off the phone, and there is no machine learning (the prompt says to ask before either).

## Next step

`feature/transaction-category-changes`: changing a category, "Aplicar a todos", the history, the overrides backup and the M10 integration test.
