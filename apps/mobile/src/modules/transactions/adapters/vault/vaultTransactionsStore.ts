// TransactionsStore on the SQLCipher vault: table transactions_transactions.
import type { CategoryId, Id, Transaction } from '@shared/domain/types';
import type { VaultDb, VaultTx } from '@shared/ports';

import type { TransactionsStore } from '../../application/ports';
import { canonicalInstant } from '../../domain/bogota';
import type { StoreQuery, TransactionCursor } from '../../domain/query';

export interface TransactionRow {
  id: string;
  account_id: string;
  provider_tx_id: string | null;
  source: Transaction['source'];
  booked_at: string;
  amount_minor: number;
  description: string;
  merchant_raw: string | null;
  merchant_key: string | null;
  category_id: CategoryId;
  category_source: Transaction['categorySource'];
  status: Transaction['status'];
  goal_id: string | null;
}

export const TX_COLUMNS = `t.id, t.account_id, t.provider_tx_id, t.source, t.booked_at,
  t.amount_minor, t.description, t.merchant_raw, t.merchant_key, t.category_id,
  t.category_source, t.status, t.goal_id`;

export function toTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    providerTxId: row.provider_tx_id,
    source: row.source,
    bookedAt: row.booked_at,
    amountMinor: Number(row.amount_minor),
    description: row.description,
    merchantRaw: row.merchant_raw,
    merchantKey: row.merchant_key,
    categoryId: row.category_id,
    categorySource: row.category_source,
    status: row.status,
    goalId: row.goal_id,
  };
}

/** SQLite allows 999 parameters in old builds: IN lists go in chunks well below that. */
const CHUNK = 400;
const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/** WHERE clause of a query, for rows aliased `t`. */
export function whereOf(query: StoreQuery): { sql: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  if (query.start) {
    parts.push('t.booked_at >= ?');
    params.push(query.start);
  }
  if (query.end) {
    parts.push('t.booked_at < ?');
    params.push(query.end);
  }
  if (query.accountIds && query.accountIds.length > 0) {
    parts.push(`t.account_id IN (${placeholders(query.accountIds.length)})`);
    params.push(...query.accountIds);
  }
  if (query.sign) parts.push(query.sign === 'in' ? 't.amount_minor > 0' : 't.amount_minor < 0');
  if (query.minAbs !== undefined) {
    parts.push('abs(t.amount_minor) >= ?');
    params.push(query.minAbs);
  }
  if (query.maxAbs !== undefined) {
    parts.push('abs(t.amount_minor) <= ?');
    params.push(query.maxAbs);
  }
  if (query.categoryIds && query.categoryIds.length > 0) {
    parts.push(`t.category_id IN (${placeholders(query.categoryIds.length)})`);
    params.push(...query.categoryIds);
  }
  if (query.match) {
    parts.push('t.rowid IN (SELECT rowid FROM transactions_fts WHERE transactions_fts MATCH ?)');
    params.push(query.match);
  }
  return { sql: parts.length > 0 ? parts.join(' AND ') : '1 = 1', params };
}

async function existingProviderIds(
  tx: VaultTx,
  accountId: Id,
  ids: string[],
): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const rows = await tx.query<{ provider_tx_id: string }>(
      `SELECT provider_tx_id FROM transactions_transactions
       WHERE account_id = ? AND provider_tx_id IN (${placeholders(chunk.length)})`,
      [accountId, ...chunk],
    );
    for (const r of rows) found.add(r.provider_tx_id);
  }
  return found;
}

export function createVaultTransactionsStore(db: VaultDb): TransactionsStore {
  return {
    upsertSynced({ accountId, since, transactions }) {
      return db.transaction(async (tx) => {
        const providerIds = transactions.map((t) => t.providerTxId ?? '');
        const before = await existingProviderIds(tx, accountId, providerIds);
        const newIds: Id[] = [];
        for (const t of transactions) {
          if (!before.has(t.providerTxId ?? '')) newIds.push(t.id);
          // The bank owns what happened; the person and M7 own the category and the goal.
          await tx.execute(
            `INSERT INTO transactions_transactions (id, account_id, provider_tx_id, source,
               booked_at, amount_minor, description, merchant_raw, merchant_key, category_id,
               category_source, status, goal_id)
             VALUES (?, ?, ?, 'bank', ?, ?, ?, ?, ?, ?, ?, ?, NULL)
             ON CONFLICT (account_id, provider_tx_id) DO UPDATE SET
               booked_at = excluded.booked_at, amount_minor = excluded.amount_minor,
               description = excluded.description, merchant_raw = excluded.merchant_raw,
               merchant_key = excluded.merchant_key, status = excluded.status`,
            [
              t.id,
              accountId,
              t.providerTxId,
              t.bookedAt,
              t.amountMinor,
              t.description,
              t.merchantRaw,
              t.merchantKey,
              t.categoryId,
              t.categorySource,
              t.status,
            ],
          );
        }
        // A pending movement the bank no longer returns was cancelled or booked under a new id.
        const pending = await tx.query<{ id: string; provider_tx_id: string }>(
          `SELECT id, provider_tx_id FROM transactions_transactions
           WHERE account_id = ? AND source = 'bank' AND status = 'pending' AND booked_at >= ?`,
          [accountId, canonicalInstant(since)],
        );
        const kept = new Set(providerIds);
        for (const row of pending) {
          if (!kept.has(row.provider_tx_id)) {
            await tx.execute('DELETE FROM transactions_transactions WHERE id = ?', [row.id]);
          }
        }
        return { newIds };
      });
    },

    async page(query, cursor: TransactionCursor | null, limit) {
      const where = whereOf(query);
      const after = cursor ? ' AND (t.booked_at < ? OR (t.booked_at = ? AND t.id < ?))' : '';
      const rows = await db.query<TransactionRow>(
        `SELECT ${TX_COLUMNS} FROM transactions_transactions t
         WHERE ${where.sql}${after}
         ORDER BY t.booked_at DESC, t.id DESC LIMIT ?`,
        [...where.params, ...(cursor ? [cursor.bookedAt, cursor.bookedAt, cursor.id] : []), limit],
      );
      return rows.map(toTransaction);
    },

    async summary(query) {
      const where = whereOf(query);
      const rows = await db.query<{ n: number; income: number | null; spend: number | null }>(
        `SELECT count(*) AS n,
           sum(CASE WHEN t.amount_minor > 0 THEN t.amount_minor ELSE 0 END) AS income,
           sum(CASE WHEN t.amount_minor < 0 THEN t.amount_minor ELSE 0 END) AS spend
         FROM transactions_transactions t WHERE ${where.sql}`,
        where.params,
      );
      const row = rows[0];
      return {
        count: Number(row?.n ?? 0),
        incomeMinor: Number(row?.income ?? 0),
        spendMinor: Number(row?.spend ?? 0),
      };
    },

    async list(query) {
      const where = whereOf(query);
      const rows = await db.query<TransactionRow>(
        `SELECT ${TX_COLUMNS} FROM transactions_transactions t
         WHERE ${where.sql} ORDER BY t.booked_at DESC, t.id DESC`,
        where.params,
      );
      return rows.map(toTransaction);
    },

    async get(id) {
      const rows = await db.query<TransactionRow>(
        `SELECT ${TX_COLUMNS} FROM transactions_transactions t WHERE t.id = ?`,
        [id],
      );
      return rows[0] ? toTransaction(rows[0]) : null;
    },

    async setGoal(id, goalId) {
      return db.transaction(async (tx) => {
        const rows = await tx.query<{ id: string }>(
          'SELECT id FROM transactions_transactions WHERE id = ?',
          [id],
        );
        if (rows.length === 0) return false;
        await tx.execute('UPDATE transactions_transactions SET goal_id = ? WHERE id = ?', [
          goalId,
          id,
        ]);
        return true;
      });
    },
  };
}
