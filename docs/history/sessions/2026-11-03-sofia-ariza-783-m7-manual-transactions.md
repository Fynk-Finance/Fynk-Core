---
date: 2026-11-03
developer: Sofia Nicolle Ariza
github: sofia-ariza-783
module: M7
jira: [SCRUM-29, SCRUM-32]
branch: feature/manual-transactions
tool: Claude Code
pr: "#240"
status: done
---

# Manual movements and the transactions.manual backup

## Instruction

Same session as the M7 stack. Work plan step 5: "create, edit, delete, backup collection". The prompt's Nuevo movimiento manual: "amount, ingreso or gasto, account (including Efectivo), date, description, category". This branch is the data side; the sheet comes next.

## What was done

* `domain/manual.ts`: `ManualInput`, its checks (account, amount in whole centavos above zero, date, description up to 80 characters, category) and the movement to save. Money out is saved negative. The category comes from the person or from the pipeline on the description.
* `adapters/vault/migrations.ts` v3: `transactions_manual_tombstones`, so a deletion reaches other phones through the backup.
* `adapters/vault/vaultManualStore.ts`: save with the backup version up by one, delete with a tombstone, export and import (highest version wins).
* `application/manualService.ts`: `addManualTransaction`, `updateManualTransaction`, `deleteManualTransaction` (manual movements only), each with `markDirty` and `transactions.changed`, and the `transactions.manual` collection.
* A goal (M8) or category change on a manual movement raises its backup version in SQL, and `index.ts` marks it for the backup on `transactions.changed`.
* Tests:
  * Cash expense categorized from its description; income with a picked category; found by the search.
  * Validation; editing keeps the goal; a bank movement can never be edited or deleted; deleting; a sync never removes a manual movement.
  * Backup to a new phone with a deletion; an old backup that loses; a goal change as a new version.

## Result

* Tests: 2316 of 2316 in the app. Lint, typecheck and Prettier clean.
* Pull request: in the M7 stack, above the detail screen.

## Decisions and problems

* A manual movement is a record only. It never changes the balance of a bank account or of Efectivo (rule 6, Fynk never moves money; cash is the amount the person types in M6). This needs the team's review.
* Manual movements have no merchant, so "Aplicar a todos" is never offered for them; the person picks the category of each one.
* Deletions need tombstones because the backup contract sends `deleted: true` records.

## Next step

`feature/manual-transaction-sheet`: the sheet to register and edit a movement, and edit and delete on its detail.
