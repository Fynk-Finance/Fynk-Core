// Encrypted backup of the recurring module (HU-045): the collection recurring.items of M2. The
// usage mark ("¿Cuánto la usas?") is a column of the item, so it travels inside each record and
// the module has no separate recurring.usage_marks collection. M2 encrypts what `exportAll`
// gives and hands the newest copy of each record back to `importAll` on a restore.
import { isCategoryId } from '@shared/domain';
import type { CategoryId, Id, IsoDateTime, MoneyMinor } from '@shared/domain/types';
import type { BackupCollection, MarkDirty, VaultDb } from '@shared/ports';

import type { Periodicity, Schedule, Usage } from '../../domain/types';
import { scheduleColumns, scheduleOf } from '../vault/vaultRecurringStore';
import { RECURRING_BACKUP_COLLECTIONS } from './collections';

export { RECURRING_BACKUP_COLLECTIONS };

export interface RecurringItemBackupData {
  kind: 'fixed' | 'subscription';
  name: string;
  categoryId: CategoryId;
  merchantKey: string | null;
  amountMinor: MoneyMinor;
  schedule: Schedule;
  accountId: Id | null;
  status: 'active' | 'cancelled';
  usage: Usage | null;
  reminderEnabled: boolean;
  source: 'manual' | 'detected';
  createdAt: IsoDateTime;
  cancelledAt: IsoDateTime | null;
  deletedAt: IsoDateTime | null;
}

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
  cancelled_at: string | null;
  deleted_at: string | null;
  version: number;
}

const PERIODICITIES: readonly string[] = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly'];
const isTextOrNull = (v: unknown): v is string | null => v === null || typeof v === 'string';

function isSchedule(s: unknown): s is Schedule {
  const x = s as Record<string, unknown> | null;
  if (!x || !PERIODICITIES.includes(x.periodicity as string)) return false;
  switch (x.periodicity) {
    case 'monthly':
      return Number.isInteger(x.anchorDay) && (x.anchorDay as number) >= 1;
    case 'daily':
    case 'weekly':
      return Number.isInteger(x.weekdaysMask);
    default:
      return typeof x.anchorDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.anchorDate);
  }
}

function isItemData(d: unknown): d is RecurringItemBackupData {
  const i = d as Partial<RecurringItemBackupData> | null;
  return (
    !!i &&
    (i.kind === 'fixed' || i.kind === 'subscription') &&
    typeof i.name === 'string' &&
    i.name.length > 0 &&
    isCategoryId(i.categoryId ?? '') &&
    Number.isInteger(i.amountMinor) &&
    (i.amountMinor as number) > 0 &&
    isSchedule(i.schedule) &&
    (i.status === 'active' || i.status === 'cancelled') &&
    (i.usage == null || i.usage === 'high' || i.usage === 'some' || i.usage === 'low') &&
    typeof i.reminderEnabled === 'boolean' &&
    (i.source === 'manual' || i.source === 'detected') &&
    typeof i.createdAt === 'string' &&
    isTextOrNull(i.merchantKey ?? null) &&
    isTextOrNull(i.accountId ?? null) &&
    isTextOrNull(i.cancelledAt ?? null) &&
    isTextOrNull(i.deletedAt ?? null)
  );
}

export interface RecurringBackup {
  items: BackupCollection<RecurringItemBackupData>;
  /**
   * Marks dirty the items that existed before the backup (migration 2 lists them in
   * recurring_backup_pending), once, so people who already had items get them backed up.
   */
  flushPending(): Promise<void>;
}

export function createRecurringBackup({
  db,
  markDirty,
  onImported,
}: {
  db: () => VaultDb;
  markDirty: MarkDirty;
  /** After a restore wrote something: Billetera reloads and the reminders are planned again. */
  onImported: () => void;
}): RecurringBackup {
  const items: BackupCollection<RecurringItemBackupData> = {
    module: 'recurring',
    collection: RECURRING_BACKUP_COLLECTIONS.items,
    async exportAll() {
      const rows = await db().query<Row>('SELECT * FROM recurring_items ORDER BY id');
      return rows.map((r) => ({
        id: r.id,
        version: r.version,
        deleted: r.deleted_at !== null,
        data: {
          kind: r.kind,
          name: r.name,
          categoryId: r.category_id as CategoryId,
          merchantKey: r.merchant_key,
          amountMinor: r.amount_minor,
          schedule: scheduleOf(r),
          accountId: r.account_id,
          status: r.status,
          usage: r.usage,
          reminderEnabled: r.reminder_enabled === 1,
          source: r.source,
          createdAt: r.created_at,
          cancelledAt: r.cancelled_at,
          deletedAt: r.deleted_at,
        },
      }));
    },
    async importAll(records) {
      await db().transaction(async (tx) => {
        for (const r of records) {
          if (!isItemData(r.data)) continue;
          const d = r.data;
          const [periodicity, anchorDay, mask, anchorDate] = scheduleColumns(d.schedule);
          await tx.execute(
            `INSERT INTO recurring_items
               (id, kind, name, category_id, merchant_key, amount_minor, periodicity, anchor_day,
                weekdays_mask, anchor_date, account_id, status, usage, reminder_enabled, source,
                created_at, cancelled_at, deleted_at, version)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (id) DO UPDATE SET
               kind = excluded.kind, name = excluded.name, category_id = excluded.category_id,
               merchant_key = excluded.merchant_key, amount_minor = excluded.amount_minor,
               periodicity = excluded.periodicity, anchor_day = excluded.anchor_day,
               weekdays_mask = excluded.weekdays_mask, anchor_date = excluded.anchor_date,
               account_id = excluded.account_id, status = excluded.status, usage = excluded.usage,
               reminder_enabled = excluded.reminder_enabled, source = excluded.source,
               cancelled_at = excluded.cancelled_at, deleted_at = excluded.deleted_at,
               version = excluded.version
             WHERE excluded.version > recurring_items.version`,
            [
              r.id,
              d.kind,
              d.name,
              d.categoryId,
              d.merchantKey ?? null,
              d.amountMinor,
              periodicity,
              anchorDay,
              mask,
              anchorDate,
              d.accountId ?? null,
              d.status,
              d.kind === 'subscription' ? (d.usage ?? null) : null,
              d.reminderEnabled ? 1 : 0,
              d.source,
              d.createdAt,
              d.cancelledAt ?? null,
              r.deleted ? (d.deletedAt ?? d.createdAt) : null,
              r.version,
            ],
          );
        }
      });
      onImported();
    },
  };

  return {
    items,
    async flushPending() {
      const rows = await db().query<{ collection: string; record_id: string }>(
        'SELECT collection, record_id FROM recurring_backup_pending',
      );
      if (rows.length === 0) return;
      for (const r of rows) markDirty(r.collection, r.record_id);
      await db().execute('DELETE FROM recurring_backup_pending');
    },
  };
}
