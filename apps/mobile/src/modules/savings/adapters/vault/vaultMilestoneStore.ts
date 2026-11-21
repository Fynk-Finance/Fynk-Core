// MilestoneStore on the SQLCipher vault (table savings_milestones in ./migrations.ts).
import type { VaultDb } from '@shared/ports';

import type { MilestoneStore } from '../../application/milestonePorts';
import type { Milestone } from '../../domain/goals';

export function createVaultMilestoneStore(db: VaultDb): MilestoneStore {
  return {
    async noticed(goalId) {
      const rows = await db.query<{ milestone: Milestone }>(
        'SELECT milestone FROM savings_milestones WHERE goal_id = ? ORDER BY milestone',
        [goalId],
      );
      return rows.map((r) => r.milestone);
    },

    async record(goalId, milestones, at) {
      await db.transaction(async (tx) => {
        for (const milestone of milestones)
          await tx.execute(
            `INSERT OR IGNORE INTO savings_milestones (goal_id, milestone, reached_at)
             VALUES (?, ?, ?)`,
            [goalId, milestone, at],
          );
      });
    },
  };
}
