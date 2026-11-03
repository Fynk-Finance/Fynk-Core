---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-32]
branch: feature/transaction-category-changes
tool: Claude Code
pr: "#238"
status: done
---

# Changing a category: history, overrides and the M10 totals

## Instruction

Same session as the M7 stack. HU-018: "Modificación manual. Historial de cambios. Actualiza reportes asociados". The prompt: "Changing a category asks ¿Aplicar a todos los movimientos de <comercio>? Yes creates an override and recategorizes past movements of that merchant. Each change is stored in transactions_category_changes, then emits transactions.changed." Test: "A recategorization emits transactions.changed and M10's monthly category totals change accordingly (integration test with M10 stub)".

## What was done

* `application/categoryService.ts`: `changeCategory(id, categoryId, { applyToMerchant })` and `getCategoryHistory(id)`.
  * With "aplicar a todos", every movement of the merchant changes and a merchant override stays for the next ones.
  * Without it, a bank movement keeps an override by the bank's id.
  * One history line per movement whose category really changed, then `transactions.changed`.
* `adapters/vault/vaultCategoryStore.ts`: the change and its history in one vault transaction, and the overrides with their backup version.
* Backup collection `transactions.category_overrides`, records `merchant:<key>` and `transaction:<bank id>`. The highest version wins, so an old backup never undoes a newer choice. It is registered in `index.ts`, and `markDirty` runs after each change.
* `index.ts` exports `changeCategory`, `getCategoryHistory`, `CategoryChange` and `InvalidCategoryError`.
* `src/app/AppRoot.test.tsx` (M0): the vault stand-in gets `registerBackupCollection` and `markDirty`, because M7 is the first module that registers a collection when it loads.
* Tests:
  * One movement; the whole merchant plus the next sync.
  * The history newest first; no history when nothing changes; unknown movement or category.
  * Backup export, restore on a new phone and first sync there, and an old backup that loses.
  * The M10 stub: Antojos goes down and Restaurantes goes up after a change.

## Result

* Tests: 2300 of 2300 in the app. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the categorization.

## Decisions and problems

* "Aplicar a todos" also changes movements whose category the person had picked one by one: the person asked for all of them.
* The history of bank movements is not in the backup. On a new phone the categories come back through the overrides, but the history lines do not. Backing it up would need a new collection that is not in the shared contracts.
* A manual movement leaves no override; it is backed up whole with `transactions.manual` (next branches).
* The M10 test uses a stub that recounts on `transactions.changed`, because M10's own wiring (`configureAnalytics`) is not called by the app yet.

## Next step

`feature/transaction-detail-screen`: the movement detail with "Cambiar categoría", the question "¿Aplicar a todos…?" and the history.
