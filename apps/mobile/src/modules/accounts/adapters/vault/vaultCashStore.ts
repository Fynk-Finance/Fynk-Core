// CashStore on the SQLCipher vault: the cash row of accounts_accounts and accounts_cash_history.
import type { Id, IsoDateTime, MoneyMinor } from '@shared/domain/types';
import type { BackupRecord, VaultDb, VaultTx } from '@shared/ports';

import type { CashStore } from '../../application/ports';
import type { CashBackupData } from '../../domain/cash';

interface CashRow {
  id: string;
  balance_minor: number;
  last_synced_at: string;
  status: string;
  backup_version: number;
}

interface HistoryRow {
  id: string;
  amount_minor: number;
  set_at: string;
}

async function upsertCash(
  tx: VaultTx,
  c: { id: Id; amountMinor: MoneyMinor; setAt: IsoDateTime; version: number },
): Promise<void> {
  await tx.execute(
    `INSERT INTO accounts_accounts (id, provider, provider_account_id, link_id, kind, display_name,
       last4, currency, balance_minor, status, is_simulated, last_synced_at, created_at,
       backup_version)
     VALUES (?, 'manual', NULL, NULL, 'cash', 'Efectivo', NULL, 'COP', ?, 'active', 0, ?, ?, ?)`,
    [c.id, c.amountMinor, c.setAt, c.setAt, c.version],
  );
}

export function createVaultCashStore(db: VaultDb): CashStore {
  const current = async (tx: VaultTx) =>
    (
      await tx.query<CashRow>(
        `SELECT id, balance_minor, last_synced_at, status, backup_version
         FROM accounts_accounts WHERE kind = 'cash'`,
      )
    )[0];

  return {
    async get() {
      const row = await current(db);
      return row && row.status === 'active'
        ? { id: row.id, amountMinor: row.balance_minor, setAt: row.last_synced_at }
        : null;
    },

    async set({ newAccountId, historyId, amountMinor, setAt }) {
      return db.transaction(async (tx) => {
        const row = await current(tx);
        const id = row?.id ?? newAccountId;
        if (row) {
          await tx.execute(
            `UPDATE accounts_accounts SET balance_minor = ?, last_synced_at = ?, status = 'active',
               backup_version = backup_version + 1
             WHERE id = ?`,
            [amountMinor, setAt, id],
          );
        } else {
          await upsertCash(tx, { id, amountMinor, setAt, version: 1 });
        }
        await tx.execute(
          'INSERT INTO accounts_cash_history (id, amount_minor, set_at) VALUES (?, ?, ?)',
          [historyId, amountMinor, setAt],
        );
        return id;
      });
    },

    async exportAll() {
      const records: BackupRecord<CashBackupData>[] = [];
      const row = await current(db);
      if (row) {
        records.push({
          id: row.id,
          version: row.backup_version,
          deleted: row.status !== 'active',
          data: { type: 'account', amountMinor: row.balance_minor, setAt: row.last_synced_at },
        });
      }
      const history = await db.query<HistoryRow>(
        'SELECT id, amount_minor, set_at FROM accounts_cash_history ORDER BY set_at, id',
      );
      for (const h of history) {
        records.push({
          id: h.id,
          version: 1,
          deleted: false,
          data: { type: 'history', amountMinor: h.amount_minor, setAt: h.set_at },
        });
      }
      return records;
    },

    async importAll(records) {
      await db.transaction(async (tx) => {
        for (const r of records) {
          if (r.data.type === 'history' && !r.deleted) {
            await tx.execute(
              `INSERT INTO accounts_cash_history (id, amount_minor, set_at) VALUES (?, ?, ?)
               ON CONFLICT (id) DO NOTHING`,
              [r.id, r.data.amountMinor, r.data.setAt],
            );
            continue;
          }
          if (r.data.type !== 'account') continue;
          // Highest version wins. The restored account replaces a cash row with another id.
          const row = await current(tx);
          if (row && row.id === r.id && row.backup_version >= r.version) continue;
          if (row) await tx.execute('DELETE FROM accounts_accounts WHERE id = ?', [row.id]);
          await upsertCash(tx, {
            id: r.id,
            amountMinor: r.data.amountMinor,
            setAt: r.data.setAt,
            version: r.version,
          });
          if (r.deleted) {
            await tx.execute(`UPDATE accounts_accounts SET status = 'closed' WHERE id = ?`, [r.id]);
          }
        }
      });
    },
  };
}
