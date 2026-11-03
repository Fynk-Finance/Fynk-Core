// ManualStore on the SQLCipher vault: manual rows of transactions_transactions, their backup
// version, and the tombstones of the deleted ones (transactions_manual_tombstones).
import type { Id, Transaction } from '@shared/domain/types';
import type { BackupRecord, VaultDb, VaultTx } from '@shared/ports';

import type { ManualStore } from '../../application/ports';
import { toTransaction, TX_COLUMNS, type TransactionRow } from './vaultTransactionsStore';

type ManualRow = TransactionRow & { backup_version: number };

async function versionOf(tx: VaultTx, id: Id): Promise<number | null> {
  const rows = await tx.query<{ v: number }>(
    `SELECT backup_version AS v FROM transactions_transactions WHERE id = ? AND source = 'manual'
     UNION ALL SELECT backup_version AS v FROM transactions_manual_tombstones WHERE id = ?`,
    [id, id],
  );
  return rows.length > 0 ? Math.max(...rows.map((r) => Number(r.v))) : null;
}

async function write(tx: VaultTx, t: Transaction, version: number): Promise<void> {
  await tx.execute('DELETE FROM transactions_manual_tombstones WHERE id = ?', [t.id]);
  await tx.execute(
    `INSERT INTO transactions_transactions (id, account_id, provider_tx_id, source, booked_at,
       amount_minor, description, merchant_raw, merchant_key, category_id, category_source,
       status, goal_id, backup_version)
     VALUES (?, ?, NULL, 'manual', ?, ?, ?, NULL, NULL, ?, ?, 'booked', ?, ?)
     ON CONFLICT (id) DO UPDATE SET account_id = excluded.account_id,
       booked_at = excluded.booked_at, amount_minor = excluded.amount_minor,
       description = excluded.description, category_id = excluded.category_id,
       category_source = excluded.category_source, goal_id = excluded.goal_id,
       backup_version = excluded.backup_version`,
    [
      t.id,
      t.accountId,
      t.bookedAt,
      t.amountMinor,
      t.description,
      t.categoryId,
      t.categorySource,
      t.goalId,
      version,
    ],
  );
}

async function remove(tx: VaultTx, id: Id, version: number): Promise<void> {
  await tx.execute("DELETE FROM transactions_transactions WHERE id = ? AND source = 'manual'", [
    id,
  ]);
  await tx.execute(
    `INSERT INTO transactions_manual_tombstones (id, backup_version) VALUES (?, ?)
     ON CONFLICT (id) DO UPDATE SET backup_version = excluded.backup_version`,
    [id, version],
  );
}

export function createVaultManualStore(db: VaultDb): ManualStore {
  return {
    save(t) {
      return db.transaction(async (tx) => {
        const current = await versionOf(tx, t.id);
        await write(tx, t, (current ?? 0) + 1);
      });
    },

    delete(id) {
      return db.transaction(async (tx) => {
        const current = await versionOf(tx, id);
        const exists = await tx.query<{ id: string }>(
          "SELECT id FROM transactions_transactions WHERE id = ? AND source = 'manual'",
          [id],
        );
        if (exists.length === 0) return false;
        await remove(tx, id, (current ?? 0) + 1);
        return true;
      });
    },

    async manualIds(ids) {
      if (ids.length === 0) return [];
      const rows = await db.query<{ id: string }>(
        `SELECT id FROM transactions_transactions
         WHERE source = 'manual' AND id IN (${ids.map(() => '?').join(', ')})`,
        ids,
      );
      return rows.map((r) => r.id);
    },

    async exportAll() {
      const rows = await db.query<ManualRow>(
        `SELECT ${TX_COLUMNS}, t.backup_version FROM transactions_transactions t
         WHERE t.source = 'manual' ORDER BY t.id`,
      );
      const tombstones = await db.query<{ id: string; backup_version: number }>(
        'SELECT id, backup_version FROM transactions_manual_tombstones ORDER BY id',
      );
      const records: BackupRecord<Transaction | null>[] = [
        ...rows.map((r) => ({
          id: r.id,
          version: Number(r.backup_version),
          deleted: false,
          data: toTransaction(r),
        })),
        ...tombstones.map((r) => ({
          id: r.id,
          version: Number(r.backup_version),
          deleted: true,
          data: null,
        })),
      ];
      return records;
    },

    importAll(records) {
      return db.transaction(async (tx) => {
        for (const record of records) {
          const current = await versionOf(tx, record.id);
          // Highest version wins: a stale backup never undoes a newer local change.
          if (current !== null && current >= record.version) continue;
          if (record.deleted || !record.data) await remove(tx, record.id, record.version);
          else await write(tx, { ...record.data, id: record.id }, record.version);
        }
      });
    },
  };
}
