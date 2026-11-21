// GoalStore on the SQLCipher vault (tables in ./migrations.ts). Every write bumps the version and
// marks the row dirty for M2's encrypted backup (HU-045); deleting leaves tombstones.
import type { Id, IsoDate, MoneyMinor } from '@shared/domain/types';
import type { MarkDirty, VaultDb } from '@shared/ports';

import { SAVINGS_BACKUP_COLLECTIONS } from '../backup/savingsBackup';

import type { Goal } from '../../domain/goal';
import type { GoalCategory } from '../../domain/goals';
import type { GoalStore } from '../../application/ports';

interface Row {
  id: string;
  name: string;
  category: GoalCategory;
  target_minor: number;
  deadline_month: string;
  created_at: string;
}

const toGoal = (r: Row): Goal => ({
  id: r.id,
  name: r.name,
  category: r.category,
  targetMinor: r.target_minor,
  deadline: r.deadline_month,
  createdAt: r.created_at,
});

const COLUMNS = 'id, name, category, target_minor, deadline_month, created_at';

/** Rows that are shown: not archived and not deleted. */
const LIVE = 'archived_at IS NULL AND deleted_at IS NULL';

const noDirty: MarkDirty = () => undefined;

export function createVaultGoalStore(db: VaultDb, markDirty: MarkDirty = noDirty): GoalStore {
  return {
    async list() {
      const rows = await db.query<Row>(`SELECT ${COLUMNS} FROM savings_goals WHERE ${LIVE}`);
      return rows.map(toGoal);
    },

    async get(id: Id) {
      const [row] = await db.query<Row>(
        `SELECT ${COLUMNS} FROM savings_goals WHERE id = ? AND ${LIVE}`,
        [id],
      );
      return row ? toGoal(row) : null;
    },

    async save(goal) {
      await db.execute(
        `INSERT INTO savings_goals (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name, category = excluded.category,
           target_minor = excluded.target_minor, deadline_month = excluded.deadline_month,
           version = savings_goals.version + 1`,
        [goal.id, goal.name, goal.category, goal.targetMinor, goal.deadline, goal.createdAt],
      );
      markDirty(SAVINGS_BACKUP_COLLECTIONS.goals, goal.id);
    },

    async remove(id, at) {
      let contributionIds: Id[] = [];
      await db.transaction(async (tx) => {
        const rows = await tx.query<{ id: string }>(
          'SELECT id FROM savings_contributions WHERE goal_id = ? AND deleted_at IS NULL',
          [id],
        );
        contributionIds = rows.map((r) => r.id);
        await tx.execute(
          `UPDATE savings_contributions SET deleted_at = ?, version = version + 1
           WHERE goal_id = ? AND deleted_at IS NULL`,
          [at, id],
        );
        await tx.execute('DELETE FROM savings_milestones WHERE goal_id = ?', [id]);
        await tx.execute(
          `UPDATE savings_goals SET deleted_at = ?, version = version + 1
           WHERE id = ? AND deleted_at IS NULL`,
          [at, id],
        );
      });
      markDirty(SAVINGS_BACKUP_COLLECTIONS.goals, id);
      for (const c of contributionIds) markDirty(SAVINGS_BACKUP_COLLECTIONS.contributions, c);
    },

    async savedByGoal() {
      const rows = await db.query<{ goal_id: string; saved: number; last_on: string }>(
        `SELECT goal_id, SUM(amount_minor) AS saved, MAX(contributed_on) AS last_on
         FROM savings_contributions WHERE deleted_at IS NULL GROUP BY goal_id`,
      );
      return new Map<Id, { savedMinor: MoneyMinor; lastOn: IsoDate }>(
        rows.map((r) => [r.goal_id, { savedMinor: r.saved, lastOn: r.last_on }]),
      );
    },

    async contributedBetween(from, to) {
      const [row] = await db.query<{ total: number | null }>(
        `SELECT SUM(amount_minor) AS total FROM savings_contributions
         WHERE deleted_at IS NULL AND contributed_on BETWEEN ? AND ?`,
        [from, to],
      );
      return row?.total ?? 0;
    },

    async contributionsSince(from) {
      const rows = await db.query<{
        goal_id: string;
        amount_minor: number;
        contributed_on: string;
      }>(
        `SELECT goal_id, amount_minor, contributed_on FROM savings_contributions
         WHERE deleted_at IS NULL AND contributed_on >= ?`,
        [from],
      );
      return rows.map((r) => ({
        goalId: r.goal_id,
        amountMinor: r.amount_minor,
        contributedOn: r.contributed_on,
      }));
    },
  };
}
