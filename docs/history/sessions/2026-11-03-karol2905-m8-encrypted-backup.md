---
date: 2026-11-03
developer: Karol
github: Karol2905
module: M8
jira: [SCRUM-52, SCRUM-51]
branch: feature/savings-encrypted-backup
tool: Claude Code
pr: none
status: done
---

# Goals and aportes in the encrypted backup (HU-045)

## Instruction

Third item of the list Karol approved ("Si, hazlo"): do the TODO that Daniel (M2) left in `savings/adapters/backup/savingsBackup.ts`, so goals and aportes travel in the encrypted backup to a new phone.

## What was done

* **Migration 3** (versions 1 and 2 untouched):
  * adds `version` to goals and aportes, and `deleted_at` to goals;
  * adds `savings_backup_pending`, filled with the rows that already existed.
* **Stores:**
  * Every write bumps `version` and calls M2's `markDirty` with the collection and the id.
  * Deleting a goal no longer erases it. It leaves tombstones on the goal and on each of its aportes (the milestones are still deleted), and marks all of them dirty.
  * The readers hide deleted goals.
  * `GoalStore.remove` gets the time from the service clock.
* **`createSavingsBackup`:**
  * `exportAll` covers both collections, deleted rows included.
  * `importAll` runs in one transaction. The highest version wins, tombstones are honoured, and records with an unexpected shape are skipped.
  * An aporte whose goal has not arrived yet waits for the goals, because M2 does not promise an order between collections.
  * An aporte of a deleted goal, or of a movement another aporte already counts, is kept as deleted.
  * After an import, Metas reloads (`notifyChanged`). An import marks nothing dirty.
  * `flushPending` runs on `vault.unlocked`: it marks the old rows dirty once and empties the table.
* **`index.ts`:** registers `savings.goals` and then `savings.contributions` with `registerBackupCollection`.
* **Tests:** `adapters/backup/savingsBackup.test.ts` (8):
  * markDirty on create, edit, aporte and undo;
  * tombstones when a goal is deleted;
  * a round trip in both import orders;
  * an older version does not overwrite;
  * a tombstone deletes;
  * a bad shape is skipped;
  * old rows are marked once.

## Result

* Tests: 190 suites and 2339 tests pass. ESLint, tsc and Prettier are clean.
* Milestones are not backed up, as Daniel's TODO says. After a restore, a milestone already noticed may be noticed once more.

## Decisions and problems

* **The old rows go through a table, not a flag.** A migration can only run SQL, so it lists the rows, and the first unlock marks them dirty.
* **Waiting aportes.** M2 imports collections in download order, and an aporte references its goal (foreign key). So an aporte that arrives first is kept in memory until the goals are imported.
* **The link from a movement is not restored on M7's side.** The aporte keeps `transactionId`, but the "Aporte a plan de ahorro" label of the movement lives in M7. Bank movements are never backed up, and they come back with the next sync.

## Next step

The same for M9: `recurring.items` and `recurring.usage_marks`.
