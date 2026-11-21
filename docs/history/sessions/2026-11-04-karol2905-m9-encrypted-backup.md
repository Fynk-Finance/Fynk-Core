---
date: 2026-11-04
developer: Karol
github: Karol2905
module: M9
jira: [SCRUM-56, SCRUM-57]
branch: feature/recurring-encrypted-backup
tool: Claude Code
pr: none
status: done
---

# Fixed expenses and subscriptions in the encrypted backup (HU-045)

## Instruction

"revisa y sigue con lo que toque".

* **Review:** #246 (data for M10) and #247 (savings backup) were already merged. `feature/savings-link-movement` had a conflict in the imports of `savings/index.ts`. It was rebased on `develop` and pushed with `--force-with-lease`; 2374 tests pass.
* **Next:** the same backup for M9.

## What was done

* **Migration 2** (version 1 untouched): `version` and `deleted_at` on `recurring_items`, and `recurring_backup_pending`, filled with the items that already existed.
* **Store:**
  * Every write bumps `version` and calls M2's `markDirty('recurring.items', id)`: create, edit, usage, reminder, "No es una suscripción" and "Ya la cancelé".
  * Deleting leaves a tombstone, and the readers hide it.
  * `RecurringStore.remove` gets the time from the service clock.
* **`adapters/backup/recurringBackup.ts`:**
  * `exportAll` includes tombstones.
  * `importAll` runs in one transaction: the highest version wins, tombstones are honoured, and records with an unexpected category, schedule or shape are skipped.
  * After a restore, Billetera reloads (new `notifyChanged` on the service) and the reminders are planned again.
  * `flushPending` runs on `vault.unlocked`.
* **`index.ts`:** registers `recurring.items`.
* **Tests:** `adapters/backup/recurringBackup.test.ts` (7):
  * every write marks the item;
  * deleting leaves a tombstone;
  * a round trip keeps the schedule and the usage mark, and marks nothing;
  * an older version does not overwrite;
  * a tombstone deletes;
  * bad data is skipped;
  * old items are marked once.

## Result

* 195 suites and 2370 tests pass. ESLint, tsc and Prettier are clean. The tsc error in `recommendations` was only old generated types in the local copy; `make generate-contract generate-ts` fixed it.

## Decisions and problems

* **No separate `recurring.usage_marks` collection.** The usage mark is a column of `recurring_items`, not a table of its own, so it travels inside each item. Shared contracts 3.2 lists `recurring.usage_marks`. If the team wants the usage history (several marks per item), it would be a table and a collection of their own.
* **Reminders after a restore.** Local reminders are not backed up. They are planned again on the new phone from the restored items.

## Next step

SCRUM-55: detect recurring payments in M7's movements after each sync, plus the "Detectamos pagos recurrentes" screen.
