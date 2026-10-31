---
date: 2026-10-30
developer: Daniel Palacios
github: Komi-yes
module: M2
jira: [SCRUM-62]
branch: chore/savings-backup-placeholder
tool: Claude Code
pr: none
status: done
---

# Placeholder for the savings backup registration

## Instruction

The backup registration of M8 belongs to its owner, Karol (`@Karol2905`). M2 only leaves a placeholder file that she can fill in, and changes nothing in how savings behaves.

## What was done

* **`apps/mobile/src/modules/savings/adapters/backup/savingsBackup.ts`:** the constant `SAVINGS_BACKUP_COLLECTIONS` (`savings.goals`, `savings.contributions`) and a `TODO(M8, @Karol2905)` block. It names the real tables and store functions of savings and tells what to register, export, import and mark dirty, using M10's `analytics.caps` as the model.
* The file imports nothing from `@modules/vault`, and nothing calls it.

## Result

* `make lint-mobile`, `make test-mobile` (111 suites, 1357 tests) and `make format-check` pass. Savings behaves as before.
* Findings for M8: neither savings table has a `version` column, `savings_goals` has no tombstone column, and `GoalStore.remove` deletes a goal and its contributions for good. The TODO describes the vault migration and the tombstone change needed.

## Decisions and problems

* The M8 owner fills in the registration, in her own pull request. M2 does not touch her stores.
* `savings_milestones` is left out of the backup, as local notifier state.

## Next step

M8 completes the TODO once the backup registry of M2 is in `develop`.
