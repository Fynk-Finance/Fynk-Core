// CategoryStore on the SQLCipher vault: category changes, their history and the overrides
// (tables transactions_category_changes, transactions_category_overrides, transactions_tx_overrides).
import type { CategoryId, Id } from '@shared/domain/types';
import type { BackupRecord, VaultDb, VaultTx } from '@shared/ports';

import type { CategoryStore } from '../../application/ports';
import { overrideRecordId, type CategoryOverride } from '../../domain/categoryChange';

const TABLES = {
  merchant: { table: 'transactions_category_overrides', key: 'merchant_key' },
  transaction: { table: 'transactions_tx_overrides', key: 'provider_tx_id' },
} as const;

interface OverrideRow {
  k: string;
  category_id: CategoryId;
  updated_at: string;
  backup_version: number;
}

async function readOverride(
  tx: VaultTx,
  kind: CategoryOverride['kind'],
  key: string,
): Promise<OverrideRow | undefined> {
  const { table, key: column } = TABLES[kind];
  const rows = await tx.query<OverrideRow>(
    `SELECT ${column} AS k, category_id, updated_at, backup_version FROM ${table}
     WHERE ${column} = ?`,
    [key],
  );
  return rows[0];
}

async function writeOverride(tx: VaultTx, o: CategoryOverride, version: number): Promise<void> {
  const { table, key } = TABLES[o.kind];
  await tx.execute(
    `INSERT INTO ${table} (${key}, category_id, updated_at, backup_version) VALUES (?, ?, ?, ?)
     ON CONFLICT (${key}) DO UPDATE SET category_id = excluded.category_id,
       updated_at = excluded.updated_at, backup_version = excluded.backup_version`,
    [o.key, o.categoryId, o.updatedAt, version],
  );
}

export function createVaultCategoryStore(db: VaultDb): CategoryStore {
  return {
    async merchantIds(merchantKey) {
      const rows = await db.query<{ id: string }>(
        'SELECT id FROM transactions_transactions WHERE merchant_key = ?',
        [merchantKey],
      );
      return rows.map((r) => r.id);
    },

    recategorize({ ids, to, at, newId, override }) {
      return db.transaction(async (tx) => {
        if (override) {
          const current = await readOverride(tx, override.kind, override.key);
          await writeOverride(
            tx,
            { ...override, categoryId: to, updatedAt: at },
            (current?.backup_version ?? 0) + 1,
          );
        }
        const changed: Id[] = [];
        for (const id of ids) {
          const rows = await tx.query<{ category_id: CategoryId; category_source: string }>(
            'SELECT category_id, category_source FROM transactions_transactions WHERE id = ?',
            [id],
          );
          const row = rows[0];
          if (!row || (row.category_id === to && row.category_source === 'user')) continue;
          if (row.category_id !== to) {
            await tx.execute(
              `INSERT INTO transactions_category_changes
                 (id, transaction_id, from_category, to_category, changed_at)
               VALUES (?, ?, ?, ?, ?)`,
              [newId(), id, row.category_id, to, at],
            );
            changed.push(id);
          }
          await tx.execute(
            "UPDATE transactions_transactions SET category_id = ?, category_source = 'user' WHERE id = ?",
            [to, id],
          );
        }
        return { changed };
      });
    },

    async history(transactionId) {
      const rows = await db.query<{
        id: string;
        transaction_id: string;
        from_category: CategoryId;
        to_category: CategoryId;
        changed_at: string;
      }>(
        `SELECT id, transaction_id, from_category, to_category, changed_at
         FROM transactions_category_changes WHERE transaction_id = ?
         ORDER BY changed_at DESC, id DESC`,
        [transactionId],
      );
      return rows.map((r) => ({
        id: r.id,
        transactionId: r.transaction_id,
        from: r.from_category,
        to: r.to_category,
        changedAt: r.changed_at,
      }));
    },

    async exportOverrides() {
      const records: BackupRecord<CategoryOverride>[] = [];
      for (const kind of ['merchant', 'transaction'] as const) {
        const { table, key } = TABLES[kind];
        const rows = await db.query<OverrideRow>(
          `SELECT ${key} AS k, category_id, updated_at, backup_version FROM ${table} ORDER BY ${key}`,
        );
        for (const r of rows) {
          const data: CategoryOverride = {
            kind,
            key: r.k,
            categoryId: r.category_id,
            updatedAt: r.updated_at,
          };
          records.push({
            id: overrideRecordId(data),
            version: Number(r.backup_version),
            deleted: false,
            data,
          });
        }
      }
      return records;
    },

    importOverrides(records) {
      return db.transaction(async (tx) => {
        for (const record of records) {
          const o = record.data;
          const current = await readOverride(tx, o.kind, o.key);
          // Highest version wins: a stale backup never undoes a newer local choice.
          if (current && Number(current.backup_version) >= record.version) continue;
          if (record.deleted) {
            const { table, key } = TABLES[o.kind];
            await tx.execute(`DELETE FROM ${table} WHERE ${key} = ?`, [o.key]);
          } else {
            await writeOverride(tx, o, record.version);
          }
        }
      });
    },
  };
}
