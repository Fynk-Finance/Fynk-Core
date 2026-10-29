// GoalStore on the SQLCipher vault (tables in ./migrations.ts).
import type { Id, MoneyMinor } from '@shared/domain/types';
import type { VaultDb } from '@shared/ports';

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

export function createVaultGoalStore(db: VaultDb): GoalStore {
  return {
    async list() {
      const rows = await db.query<Row>(
        `SELECT ${COLUMNS} FROM savings_goals WHERE archived_at IS NULL`,
      );
      return rows.map(toGoal);
    },

    async get(id: Id) {
      const [row] = await db.query<Row>(
        `SELECT ${COLUMNS} FROM savings_goals WHERE id = ? AND archived_at IS NULL`,
        [id],
      );
      return row ? toGoal(row) : null;
    },

    async save(goal) {
      await db.execute(
        `INSERT INTO savings_goals (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           name = excluded.name, category = excluded.category,
           target_minor = excluded.target_minor, deadline_month = excluded.deadline_month`,
        [goal.id, goal.name, goal.category, goal.targetMinor, goal.deadline, goal.createdAt],
      );
    },

    async remove(id) {
      await db.transaction(async (tx) => {
        await tx.execute('DELETE FROM savings_contributions WHERE goal_id = ?', [id]);
        await tx.execute('DELETE FROM savings_goals WHERE id = ?', [id]);
      });
    },

    async savedByGoal() {
      const rows = await db.query<{ goal_id: string; saved: number }>(
        `SELECT goal_id, SUM(amount_minor) AS saved FROM savings_contributions
         WHERE deleted_at IS NULL GROUP BY goal_id`,
      );
      return new Map<Id, MoneyMinor>(rows.map((r) => [r.goal_id, r.saved]));
    },
  };
}
