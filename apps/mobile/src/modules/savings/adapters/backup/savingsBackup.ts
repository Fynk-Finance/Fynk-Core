// Backup collections of the savings module (HU-045, M8). Placeholder left by M2: nothing here is
// registered or called yet, so the behaviour of savings does not change.
export const SAVINGS_BACKUP_COLLECTIONS = {
  goals: 'savings.goals',
  contributions: 'savings.contributions',
} as const;

/*
 * TODO(M8, @Karol2905): register both collections with the encrypted backup of M2.
 * Model to copy: how M10 does it for `analytics.caps` (analytics/index.ts `configureAnalytics`,
 * adapters/vault/capsStore.ts `exportAll` / `importAll`, application/analyticsService.ts `markDirty`).
 *
 * 1. Register. Call `registerBackupCollection` from `@modules/vault` once for each collection:
 *      registerBackupCollection<GoalBackupData>({
 *        module: 'savings', collection: SAVINGS_BACKUP_COLLECTIONS.goals, exportAll, importAll });
 *      registerBackupCollection<ContributionBackupData>({
 *        module: 'savings', collection: SAVINGS_BACKUP_COLLECTIONS.contributions, exportAll, importAll });
 *    Do it in `savings/index.ts` next to `registerVaultMigrations('savings', ...)`, with the same
 *    lazy `getVaultDb()` the stores use. `BackupCollection` and `BackupRecord` are in
 *    `@shared/ports` (shared/ports/backup.ts).
 *
 * 2. `exportAll` (one per collection, in the stores of adapters/vault/):
 *    - goals: every row of `savings_goals`, deleted ones too, as `{ id, version, deleted, data }`
 *      with `data` = name, category, targetMinor, deadline (`deadline_month`), createdAt. Add a
 *      `listAll()` query to `vaultGoalStore.ts`: its `list()` and `get()` hide archived rows, and
 *      the backup must not.
 *    - contributions: every row of `savings_contributions`, deleted ones too (`deleted_at` set
 *      means `deleted: true`), with `data` = goalId, amountMinor, contributedOn, source,
 *      transactionId, note, deletedAt. Add a `listAll()` query to `vaultContributionStore.ts`: its
 *      `list()` and `get()` hide deleted rows.
 *    - Do not back up `savings_milestones`. It is local state of the notifier (SCRUM-53) that only
 *      avoids repeating a notice. Rebuild it after a restore, or accept one repeated notice.
 *
 * 3. `importAll` (one per collection), in one `db.transaction`, like capsStore.importAll:
 *    - upsert with `INSERT ... ON CONFLICT (id) DO UPDATE SET ... WHERE excluded.version >
 *      savings_<table>.version`, so the highest version wins and an older copy never overwrites;
 *    - honour tombstones: an incoming `deleted: true` of a higher version sets `deleted_at` on the
 *      contribution and on the goal (see 5), and never re-creates a live row;
 *    - import goals before contributions (`savings_contributions.goal_id` references
 *      `savings_goals`), and keep a contribution whose goal is a tombstone as a tombstone too;
 *    - skip a record whose `data` does not have the expected shape, as capsStore does for an
 *      unknown category;
 *    - after an import, call `goalService.notifyChanged()` so Metas and the carousel reload.
 *
 * 4. `markDirty(collection, id)` (from `@modules/vault`) after EVERY local write, once the write
 *    has succeeded. Pass the collection name from SAVINGS_BACKUP_COLLECTIONS and the row id. The
 *    writes today are:
 *    - `GoalStore.save` in vaultGoalStore.ts (called by `goalService.create` and
 *      `goalService.update`): markDirty(goals, goal.id) and bump the version in the same statement;
 *    - `GoalStore.remove` in vaultGoalStore.ts (called by `goalService.remove`): it DELETEs the
 *      goal, all its contributions and its milestones for good. A hard delete cannot be backed up,
 *      so turn it into a tombstone: set `deleted_at` and bump the version on the goal and on each
 *      of its contributions, hide those rows in the readers, and call markDirty(goals, goalId)
 *      plus markDirty(contributions, id) for every contribution of that goal. The milestones may
 *      still be deleted;
 *    - `ContributionStore.add` in vaultContributionStore.ts (called by `contributionService.add`
 *      and `contributionService.linkMovement`): markDirty(contributions, c.id);
 *    - `ContributionStore.markDeleted` in vaultContributionStore.ts (called by
 *      `contributionService.undo`, and by `linkMovement` when M7 refuses the mark):
 *      markDirty(contributions, id) and bump the version.
 *    Pass `markDirty` into the stores or services as a dependency (as `createAnalyticsService`
 *    gets `deps.markDirty`), so tests can check each call with `createInMemoryBackupRegistry`
 *    from `@shared/testing`.
 *
 * 5. These tables have NO `version` column today (`savings_goals` and `savings_contributions` in
 *    adapters/vault/migrations.ts, versions 1 and 2), and `savings_goals` has no tombstone column
 *    (`archived_at` exists but nothing writes it). Add a vault migration, version 3, and never
 *    edit versions 1 or 2:
 *      ALTER TABLE savings_goals ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
 *      ALTER TABLE savings_goals ADD COLUMN deleted_at TEXT;
 *      ALTER TABLE savings_contributions ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
 *    Every write then does `version = version + 1` (a new row starts at 1). Existing rows start at
 *    version 1, so call markDirty once for every existing row after the migration, so people who
 *    already have goals get them backed up.
 *
 * 6. Tests: for each collection, an export and import round trip on `createInMemoryVaultDb`; an
 *    older version does not overwrite; a tombstone deletes; each write function calls markDirty
 *    once with the right collection and id; deleting a goal leaves tombstones for its contributions.
 */
