// PaydayStore on the SQLCipher vault (table savings_payday_reminders in ./migrations.ts).
import type { VaultDb } from '@shared/ports';

import type { PaydayReminder, PaydayStore } from '../../application/paydayPorts';

interface Row {
  goal_id: string;
  amount_minor: number;
  day: number;
  updated_at: string;
}

const toReminder = (r: Row): PaydayReminder => ({
  goalId: r.goal_id,
  amountMinor: r.amount_minor,
  day: r.day,
  updatedAt: r.updated_at,
});

export function createVaultPaydayStore(db: VaultDb): PaydayStore {
  return {
    async get(goalId) {
      const [row] = await db.query<Row>(
        'SELECT * FROM savings_payday_reminders WHERE goal_id = ?',
        [goalId],
      );
      return row ? toReminder(row) : null;
    },
    async list() {
      return (await db.query<Row>('SELECT * FROM savings_payday_reminders')).map(toReminder);
    },
    async save(r) {
      await db.execute(
        `INSERT INTO savings_payday_reminders (goal_id, amount_minor, day, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (goal_id) DO UPDATE SET
           amount_minor = excluded.amount_minor, day = excluded.day,
           updated_at = excluded.updated_at`,
        [r.goalId, r.amountMinor, r.day, r.updatedAt],
      );
    },
    async remove(goalId) {
      await db.execute('DELETE FROM savings_payday_reminders WHERE goal_id = ?', [goalId]);
    },
  };
}
