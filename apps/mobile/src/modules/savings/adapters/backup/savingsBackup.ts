// Encrypted backup of the savings module (HU-045): the collections savings.goals and
// savings.contributions of M2. M2 encrypts what `exportAll` gives and hands the newest copy of
// each record back to `importAll` on a restore. Milestones are not backed up: they only stop a
// notice from repeating (SCRUM-53).
import type { Id, IsoDate, IsoDateTime, MoneyMinor } from '@shared/domain/types';
import type { BackupCollection, BackupRecord, MarkDirty, VaultDb } from '@shared/ports';

import type { GoalCategory } from '../../domain/goals';

export const SAVINGS_BACKUP_COLLECTIONS = {
  goals: 'savings.goals',
  contributions: 'savings.contributions',
} as const;

export interface GoalBackupData {
  name: string;
  category: GoalCategory;
  targetMinor: MoneyMinor;
  /** "2027-06". */
  deadline: string;
  createdAt: IsoDateTime;
  deletedAt: IsoDateTime | null;
}

export interface ContributionBackupData {
  goalId: Id;
  amountMinor: MoneyMinor;
  contributedOn: IsoDate;
  source: 'manual' | 'movement';
  transactionId: Id | null;
  note: string | null;
  deletedAt: IsoDateTime | null;
}

interface GoalRow {
  id: string;
  name: string;
  category: GoalCategory;
  target_minor: number;
  deadline_month: string;
  created_at: string;
  deleted_at: string | null;
  version: number;
}

interface ContributionRow {
  id: string;
  goal_id: string;
  amount_minor: number;
  contributed_on: string;
  source: 'manual' | 'movement';
  transaction_id: string | null;
  note: string | null;
  deleted_at: string | null;
  version: number;
}

const CATEGORIES: readonly string[] = [
  'travel',
  'emergency',
  'education',
  'home',
  'vehicle',
  'other',
];
const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isTextOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';
const isPositiveInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function isGoalData(d: unknown): d is GoalBackupData {
  const g = d as Partial<GoalBackupData> | null;
  return (
    !!g &&
    isText(g.name) &&
    CATEGORIES.includes(g.category as string) &&
    isPositiveInt(g.targetMinor) &&
    typeof g.deadline === 'string' &&
    /^\d{4}-\d{2}$/.test(g.deadline) &&
    isText(g.createdAt) &&
    isTextOrNull(g.deletedAt ?? null)
  );
}

function isContributionData(d: unknown): d is ContributionBackupData {
  const c = d as Partial<ContributionBackupData> | null;
  return (
    !!c &&
    isText(c.goalId) &&
    isPositiveInt(c.amountMinor) &&
    typeof c.contributedOn === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.contributedOn) &&
    (c.source === 'manual' || c.source === 'movement') &&
    isTextOrNull(c.transactionId ?? null) &&
    isTextOrNull(c.note ?? null) &&
    isTextOrNull(c.deletedAt ?? null)
  );
}

export interface SavingsBackup {
  goals: BackupCollection<GoalBackupData>;
  contributions: BackupCollection<ContributionBackupData>;
  /**
   * Marks dirty the rows that existed before the backup (migration 3 lists them in
   * savings_backup_pending), once, so people who already had goals get them backed up.
   */
  flushPending(): Promise<void>;
}

export function createSavingsBackup({
  db,
  markDirty,
  onImported,
}: {
  db: () => VaultDb;
  markDirty: MarkDirty;
  /** After a restore wrote something: Metas and the carousel reload. */
  onImported: () => void;
}): SavingsBackup {
  // M2 does not promise an order between collections, and a contribution needs its goal: the
  // ones that arrive first wait here until the goals are imported.
  let waiting: BackupRecord<ContributionBackupData>[] = [];

  async function importContributions(
    records: BackupRecord<ContributionBackupData>[],
  ): Promise<BackupRecord<ContributionBackupData>[]> {
    const later: BackupRecord<ContributionBackupData>[] = [];
    await db().transaction(async (tx) => {
      for (const r of records) {
        if (!isContributionData(r.data)) continue;
        const d = r.data;
        const [goal] = await tx.query<{ deleted_at: string | null }>(
          'SELECT deleted_at FROM savings_goals WHERE id = ?',
          [d.goalId],
        );
        if (!goal) {
          later.push(r);
          continue;
        }
        // A contribution of a deleted goal, or of a movement another one already counts, is
        // kept as deleted: it never counts twice.
        let deletedAt = r.deleted ? (d.deletedAt ?? d.contributedOn) : null;
        if (!deletedAt && goal.deleted_at) deletedAt = goal.deleted_at;
        if (!deletedAt && d.transactionId) {
          const [taken] = await tx.query<{ id: string }>(
            `SELECT id FROM savings_contributions
             WHERE transaction_id = ? AND deleted_at IS NULL AND id <> ?`,
            [d.transactionId, r.id],
          );
          if (taken) deletedAt = d.contributedOn;
        }
        await tx.execute(
          `INSERT INTO savings_contributions
             (id, goal_id, amount_minor, contributed_on, source, transaction_id, note, deleted_at, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET
             goal_id = excluded.goal_id, amount_minor = excluded.amount_minor,
             contributed_on = excluded.contributed_on, source = excluded.source,
             transaction_id = excluded.transaction_id, note = excluded.note,
             deleted_at = excluded.deleted_at, version = excluded.version
           WHERE excluded.version > savings_contributions.version`,
          [
            r.id,
            d.goalId,
            d.amountMinor,
            d.contributedOn,
            d.source,
            d.transactionId ?? null,
            d.note ?? null,
            deletedAt,
            r.version,
          ],
        );
      }
    });
    return later;
  }

  const goals: BackupCollection<GoalBackupData> = {
    module: 'savings',
    collection: SAVINGS_BACKUP_COLLECTIONS.goals,
    async exportAll() {
      const rows = await db().query<GoalRow>(
        `SELECT id, name, category, target_minor, deadline_month, created_at, deleted_at, version
         FROM savings_goals ORDER BY id`,
      );
      return rows.map((g) => ({
        id: g.id,
        version: g.version,
        deleted: g.deleted_at !== null,
        data: {
          name: g.name,
          category: g.category,
          targetMinor: g.target_minor,
          deadline: g.deadline_month,
          createdAt: g.created_at,
          deletedAt: g.deleted_at,
        },
      }));
    },
    async importAll(records) {
      await db().transaction(async (tx) => {
        for (const r of records) {
          if (!isGoalData(r.data)) continue;
          const d = r.data;
          const deletedAt = r.deleted ? (d.deletedAt ?? d.createdAt) : null;
          await tx.execute(
            `INSERT INTO savings_goals
               (id, name, category, target_minor, deadline_month, created_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET
               name = excluded.name, category = excluded.category,
               target_minor = excluded.target_minor, deadline_month = excluded.deadline_month,
               deleted_at = excluded.deleted_at, version = excluded.version
             WHERE excluded.version > savings_goals.version`,
            [
              r.id,
              d.name,
              d.category,
              d.targetMinor,
              d.deadline,
              d.createdAt,
              deletedAt,
              r.version,
            ],
          );
          if (deletedAt)
            await tx.execute('DELETE FROM savings_milestones WHERE goal_id = ?', [r.id]);
        }
      });
      if (waiting.length > 0) {
        const pending = waiting;
        waiting = [];
        // Still without a goal after the goals arrived: the goal is not in the backup at all.
        await importContributions(pending);
      }
      onImported();
    },
  };

  const contributions: BackupCollection<ContributionBackupData> = {
    module: 'savings',
    collection: SAVINGS_BACKUP_COLLECTIONS.contributions,
    async exportAll() {
      const rows = await db().query<ContributionRow>(
        `SELECT id, goal_id, amount_minor, contributed_on, source, transaction_id, note,
                deleted_at, version
         FROM savings_contributions ORDER BY id`,
      );
      return rows.map((c) => ({
        id: c.id,
        version: c.version,
        deleted: c.deleted_at !== null,
        data: {
          goalId: c.goal_id,
          amountMinor: c.amount_minor,
          contributedOn: c.contributed_on,
          source: c.source,
          transactionId: c.transaction_id,
          note: c.note,
          deletedAt: c.deleted_at,
        },
      }));
    },
    async importAll(records) {
      waiting = [...waiting, ...(await importContributions(records))];
      onImported();
    },
  };

  return {
    goals,
    contributions,
    async flushPending() {
      const rows = await db().query<{ collection: string; record_id: string }>(
        'SELECT collection, record_id FROM savings_backup_pending',
      );
      if (rows.length === 0) return;
      for (const r of rows) markDirty(r.collection, r.record_id);
      await db().execute('DELETE FROM savings_backup_pending');
    },
  };
}
