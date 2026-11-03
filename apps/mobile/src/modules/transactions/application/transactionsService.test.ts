// Runs the service on a real SQLite vault (node:sqlite), so the store's SQL is tested too.
import type { Id, Transaction } from '@shared/domain/types';

import { transactionsMigrations } from '../adapters/vault/migrations';
import { createVaultTransactionsStore } from '../adapters/vault/vaultTransactionsStore';
import { InvalidSyncedTransactionError } from '../domain/syncedTransactions';
import { bankTx, hourlyTxs } from '../testing/fixtures';
import { createNodeSqliteVault, type NodeSqliteVault } from '../testing/nodeSqliteVault';
import {
  createTransactionsService,
  TransactionNotFoundError,
  type TransactionsService,
} from './transactionsService';

let vault: NodeSqliteVault;
let service: TransactionsService;
const emit = jest.fn();
const SINCE = '2026-01-01T00:00:00Z';

const sync = (transactions: Transaction[], accountId = 'acc-ahorros', since = SINCE) =>
  service.upsertFromSync({ accountId, since, transactions });

async function allIds(filter = {}): Promise<Id[]> {
  const ids: Id[] = [];
  let page = await service.queryTransactions(filter, { limit: 7 });
  ids.push(...page.items.map((t) => t.id));
  while (page.nextCursor) {
    page = await service.queryTransactions(filter, { cursor: page.nextCursor, limit: 7 });
    ids.push(...page.items.map((t) => t.id));
  }
  return ids;
}

beforeEach(async () => {
  vault = createNodeSqliteVault();
  vault.registerMigrations('transactions', transactionsMigrations);
  await vault.migrate();
  emit.mockReset();
  service = createTransactionsService({
    store: () => createVaultTransactionsStore(vault.db),
    events: { emit },
  });
});

afterEach(() => vault.close());

describe('upsertFromSync (HU-015 información sincronizada)', () => {
  it('saves the movements with date, amount and description, and gives the new ids', async () => {
    const tx = bankTx({ id: 'tx-1', bookedAt: '2026-09-22T14:03:00Z', amountMinor: 520_000_000 });
    expect(await sync([tx])).toEqual({ newIds: ['tx-1'] });
    expect(await service.getTransaction('tx-1')).toEqual({
      ...tx,
      bookedAt: '2026-09-22T14:03:00.000Z',
    });
  });

  it('never duplicates a movement synced again and keeps its category and goal', async () => {
    await sync([bankTx({ id: 'tx-1', bookedAt: '2026-09-22T14:03:00Z' })]);
    await vault.db.execute(
      "UPDATE transactions_transactions SET category_id = 'groceries', category_source = 'user'",
    );
    await service.setTransactionGoal('tx-1', 'goal-1');
    const again = bankTx({
      id: 'tx-1-other-id',
      providerTxId: 'p-tx-1',
      bookedAt: '2026-09-22T14:03:00Z',
      description: 'SUPERMERCADO DEMO 2',
    });
    expect(await sync([again])).toEqual({ newIds: [] });
    expect(await service.getTransaction('tx-1')).toMatchObject({
      description: 'SUPERMERCADO DEMO 2',
      categoryId: 'groceries',
      categorySource: 'user',
      goalId: 'goal-1',
    });
    expect(await service.getTransaction('tx-1-other-id')).toBeNull();
  });

  it('deletes pending movements since `since` that the bank no longer returns', async () => {
    await sync([
      bankTx({ id: 'old', bookedAt: '2026-08-01T10:00:00Z', status: 'pending' }),
      bankTx({ id: 'gone', bookedAt: '2026-10-01T10:00:00Z', status: 'pending' }),
      bankTx({ id: 'kept', bookedAt: '2026-10-01T11:00:00Z', status: 'pending' }),
    ]);
    await sync(
      [bankTx({ id: 'kept', bookedAt: '2026-10-01T11:00:00Z' })],
      'acc-ahorros',
      '2026-09-01T00:00:00Z',
    );
    expect(await allIds()).toEqual(['kept', 'old']);
    expect((await service.getTransaction('kept'))?.status).toBe('booked');
  });

  it('writes nothing when one movement is malformed', async () => {
    const good = bankTx({ id: 'a', bookedAt: '2026-10-01T10:00:00Z' });
    await expect(
      sync([good, bankTx({ id: 'b', bookedAt: '2026-10-01T10:00:00Z', amountMinor: 1.5 })]),
    ).rejects.toThrow(InvalidSyncedTransactionError);
    await expect(sync([good, { ...good, id: 'c', accountId: 'acc-otra' }])).rejects.toThrow(
      InvalidSyncedTransactionError,
    );
    await expect(sync([good, { ...good, id: 'd' }])).rejects.toThrow('repeated');
    expect(await allIds()).toEqual([]);
  });
});

describe('queryTransactions (HU-015 paginación y orden cronológico)', () => {
  it('pages newest first and covers every row once', async () => {
    const txs = hourlyTxs(30, '2026-10-20T12:00:00Z');
    await sync(txs);
    expect(await allIds()).toEqual(txs.map((t) => t.id));
  });

  it('orders movements of the same instant by id', async () => {
    const at = '2026-10-20T12:00:00Z';
    await sync([
      bankTx({ id: 'a', bookedAt: at }),
      bankTx({ id: 'c', bookedAt: at }),
      bankTx({ id: 'b', bookedAt: at }),
    ]);
    expect(await allIds()).toEqual(['c', 'b', 'a']);
  });

  it('never repeats or skips a row when new movements arrive between pages', async () => {
    const txs = hourlyTxs(20, '2026-10-20T12:00:00Z');
    await sync(txs);
    const first = await service.queryTransactions({}, { limit: 7 });
    // A sync lands while the person reads: a newer movement (above the cursor, shown on the
    // next refresh) and one in the same instant as a row of the next page.
    await sync([
      bankTx({ id: 'new-1', bookedAt: '2026-10-21T08:00:00Z' }),
      bankTx({ id: 'tx-010-twin', providerTxId: 'twin', bookedAt: txs[10]!.bookedAt }),
    ]);
    const seen = first.items.map((t) => t.id);
    let cursor = first.nextCursor;
    while (cursor) {
      const page = await service.queryTransactions({}, { cursor, limit: 7 });
      seen.push(...page.items.map((t) => t.id));
      cursor = page.nextCursor;
    }
    const expected = txs.map((t) => t.id);
    expected.splice(10, 0, 'tx-010-twin');
    expect(seen).toEqual(expected);
  });

  it('filters by account and by Bogotá days', async () => {
    await sync([
      bankTx({ id: 'sep-30-night', bookedAt: '2026-10-01T04:30:00Z' }),
      bankTx({ id: 'oct-1', bookedAt: '2026-10-01T05:00:00Z' }),
    ]);
    await sync(
      [bankTx({ id: 'wallet', accountId: 'acc-wallet', bookedAt: '2026-10-02T10:00:00Z' })],
      'acc-wallet',
    );
    expect(await allIds({ from: '2026-10-01', to: '2026-10-31' })).toEqual(['wallet', 'oct-1']);
    expect(await allIds({ accountIds: ['acc-ahorros'] })).toEqual(['oct-1', 'sep-30-night']);
  });
});

describe('getTransactionsBetween (M9, M10)', () => {
  it('gives the movements of Bogotá days, both ends included, newest first', async () => {
    await sync([
      bankTx({ id: 'before', bookedAt: '2026-09-01T04:59:59Z' }),
      bankTx({ id: 'first', bookedAt: '2026-09-01T05:00:00Z' }),
      bankTx({ id: 'last', bookedAt: '2026-10-01T04:59:59Z' }),
      bankTx({ id: 'after', bookedAt: '2026-10-01T05:00:00Z' }),
    ]);
    const rows = await service.getTransactionsBetween('2026-09-01', '2026-09-30');
    expect(rows.map((t) => t.id)).toEqual(['last', 'first']);
  });
});

describe('setTransactionGoal (M8)', () => {
  it('links and unlinks a movement and tells the readers', async () => {
    await sync([bankTx({ id: 'tx-1', bookedAt: '2026-10-01T10:00:00Z' })]);
    await service.setTransactionGoal('tx-1', 'goal-1');
    expect((await service.getTransaction('tx-1'))?.goalId).toBe('goal-1');
    await service.setTransactionGoal('tx-1', null);
    expect((await service.getTransaction('tx-1'))?.goalId).toBeNull();
    expect(emit).toHaveBeenCalledWith({ type: 'transactions.changed', ids: ['tx-1'] });
  });

  it('throws for a movement that does not exist, so M8 can undo its contribution', async () => {
    await expect(service.setTransactionGoal('nope', 'goal-1')).rejects.toThrow(
      TransactionNotFoundError,
    );
    expect(emit).not.toHaveBeenCalled();
  });
});
