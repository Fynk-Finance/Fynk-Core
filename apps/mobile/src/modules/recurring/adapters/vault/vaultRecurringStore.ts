// RecurringStore on the SQLCipher vault (tables in ./migrations.ts). The schedule is stored in
// three columns: anchor_day (monthly), weekdays_mask (daily, weekly), anchor_date (biweekly,
// yearly); the others stay null.
import type { CategoryId, Id } from '@shared/domain/types';
import type { VaultDb } from '@shared/ports';

import type { StoredRecurringItem } from '../../domain/item';
import type { Periodicity, Schedule, Usage } from '../../domain/types';
import type { RecurringStore } from '../../application/ports';

interface Row {
  id: string;
  kind: 'fixed' | 'subscription';
  name: string;
  category_id: string;
  merchant_key: string | null;
  amount_minor: number;
  periodicity: Periodicity;
  anchor_day: number | null;
  weekdays_mask: number | null;
  anchor_date: string | null;
  account_id: string | null;
  status: 'active' | 'cancelled';
  usage: Usage | null;
  reminder_enabled: number;
  source: 'manual' | 'detected';
  created_at: string;
}

function scheduleOf(r: Row): Schedule {
  switch (r.periodicity) {
    case 'monthly':
      return { periodicity: 'monthly', anchorDay: r.anchor_day ?? 1 };
    case 'daily':
    case 'weekly':
      return { periodicity: r.periodicity, weekdaysMask: r.weekdays_mask ?? 0 };
    case 'biweekly':
    case 'yearly':
      return { periodicity: r.periodicity, anchorDate: r.anchor_date ?? '' };
  }
}

function scheduleColumns(s: Schedule): [Periodicity, number | null, number | null, string | null] {
  switch (s.periodicity) {
    case 'monthly':
      return ['monthly', s.anchorDay, null, null];
    case 'daily':
    case 'weekly':
      return [s.periodicity, null, s.weekdaysMask, null];
    case 'biweekly':
    case 'yearly':
      return [s.periodicity, null, null, s.anchorDate];
  }
}

const toItem = (r: Row): StoredRecurringItem => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  amountMinor: r.amount_minor,
  schedule: scheduleOf(r),
  status: r.status,
  usage: r.usage,
  categoryId: r.category_id as CategoryId,
  accountId: r.account_id,
  merchantKey: r.merchant_key,
  source: r.source,
  reminderEnabled: r.reminder_enabled === 1,
  createdAt: r.created_at,
});

const COLUMNS = `id, kind, name, category_id, merchant_key, amount_minor, periodicity, anchor_day,
  weekdays_mask, anchor_date, account_id, status, usage, reminder_enabled, source, created_at`;

export function createVaultRecurringStore(db: VaultDb): RecurringStore {
  return {
    async list() {
      const rows = await db.query<Row>(
        `SELECT ${COLUMNS} FROM recurring_items ORDER BY created_at, id`,
      );
      return rows.map(toItem);
    },
    async get(id: Id) {
      const [row] = await db.query<Row>(`SELECT ${COLUMNS} FROM recurring_items WHERE id = ?`, [
        id,
      ]);
      return row ? toItem(row) : null;
    },
    async save(item) {
      const [periodicity, anchorDay, mask, anchorDate] = scheduleColumns(item.schedule);
      await db.execute(
        `INSERT INTO recurring_items (${COLUMNS})
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET
           kind = excluded.kind, name = excluded.name, category_id = excluded.category_id,
           amount_minor = excluded.amount_minor, periodicity = excluded.periodicity,
           anchor_day = excluded.anchor_day, weekdays_mask = excluded.weekdays_mask,
           anchor_date = excluded.anchor_date, account_id = excluded.account_id,
           status = excluded.status, usage = excluded.usage,
           reminder_enabled = excluded.reminder_enabled`,
        [
          item.id,
          item.kind,
          item.name,
          item.categoryId,
          item.merchantKey,
          item.amountMinor,
          periodicity,
          anchorDay,
          mask,
          anchorDate,
          item.accountId,
          item.status,
          item.usage,
          item.reminderEnabled ? 1 : 0,
          item.source,
          item.createdAt,
        ],
      );
    },
    async remove(id) {
      await db.execute('DELETE FROM recurring_items WHERE id = ?', [id]);
    },
    async markCancelled(id, at) {
      await db.execute(
        `UPDATE recurring_items SET status = 'cancelled', cancelled_at = ? WHERE id = ?`,
        [at, id],
      );
    },
  };
}
