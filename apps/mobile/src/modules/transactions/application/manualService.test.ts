// Manual movements: create, edit and delete; validation; the balances they change through M6
// (team decision of 5 Nov 2026); the transactions.manual backup with deletions; and a sync
// never touching them.
import { createAppEvents } from '@shared/events/appEvents';
import { createInMemoryBackupRegistry } from '@shared/testing';

import { transactionsMigrations } from '../adapters/vault/migrations';
import { createVaultManualStore } from '../adapters/vault/vaultManualStore';
import { createVaultTransactionsStore } from '../adapters/vault/vaultTransactionsStore';
import { InvalidManualTransactionError, type ManualInput } from '../domain/manual';
import { bankTx } from '../testing/fixtures';
import { createNodeSqliteVault, type NodeSqliteVault } from '../testing/nodeSqliteVault';
import { createManualService, MANUAL_COLLECTION, type ManualService } from './manualService';
import type { ManualBalanceChange, ManualStore } from './ports';
import {
  createTransactionsService,
  TransactionNotFoundError,
  type TransactionsService,
} from './transactionsService';

let vault: NodeSqliteVault;
let service: TransactionsService;
let manual: ManualService;
let backup: ReturnType<typeof createInMemoryBackupRegistry>;
const events = createAppEvents();
const changed = jest.fn();
events.on('transactions.changed', changed);
// M6's applyManualMovement: records every change it gets.
const applied: ManualBalanceChange[] = [];
const balances = { apply: jest.fn(async (c: ManualBalanceChange) => void applied.push(c)) };

async function build(opts: { manualStore?: (store: ManualStore) => ManualStore } = {}) {
  const v = createNodeSqliteVault();
  v.registerMigrations('transactions', transactionsMigrations);
  await v.migrate();
  let n = 0;
  backup = createInMemoryBackupRegistry();
  service = createTransactionsService({
    store: () => createVaultTransactionsStore(v.db),
    events,
    treatsThreshold: async () => 2_000_000,
  });
  manual = createManualService({
    store: () => createVaultTransactionsStore(v.db),
    manual: () => (opts.manualStore ?? ((s) => s))(createVaultManualStore(v.db)),
    events,
    balances,
    newId: () => `manual-${++n}`,
    markDirty: backup.markDirty,
    treatsThreshold: async () => 2_000_000,
  });
  backup.registerBackupCollection(manual.backupCollection);
  return v;
}

const lunch: ManualInput = {
  accountId: 'acc-cash',
  kind: 'expense',
  amountMinor: 2_500_000,
  bookedAt: '2026-09-21T17:30:00Z',
  description: 'Almuerzo corrientazo',
};

beforeEach(async () => {
  changed.mockReset();
  applied.length = 0;
  balances.apply.mockClear();
  vault = await build();
});

afterEach(() => vault.close());

describe('addManualTransaction', () => {
  it('saves an expense in cash, categorized from its description', async () => {
    const tx = await manual.addManualTransaction(lunch);
    expect(tx).toEqual({
      id: 'manual-1',
      accountId: 'acc-cash',
      providerTxId: null,
      source: 'manual',
      bookedAt: '2026-09-21T17:30:00.000Z',
      amountMinor: -2_500_000,
      description: 'Almuerzo corrientazo',
      merchantRaw: null,
      merchantKey: null,
      categoryId: 'restaurants',
      categorySource: 'rule',
      status: 'booked',
      goalId: null,
    });
    expect(await service.getTransaction('manual-1')).toEqual(tx);
    expect(backup.dirty(MANUAL_COLLECTION)).toEqual(['manual-1']);
    expect(changed).toHaveBeenCalledWith({ type: 'transactions.changed', ids: ['manual-1'] });
  });

  it('keeps the category the person picked and saves income with a plus sign', async () => {
    const tx = await manual.addManualTransaction({
      ...lunch,
      kind: 'income',
      amountMinor: 12_000_000,
      description: 'Venta de ropa usada',
      categoryId: 'income_other',
    });
    expect(tx).toMatchObject({
      amountMinor: 12_000_000,
      categoryId: 'income_other',
      categorySource: 'user',
    });
  });

  it('is found by the search', async () => {
    await manual.addManualTransaction(lunch);
    expect((await service.searchTransactions('corrient')).map((t) => t.id)).toEqual(['manual-1']);
  });

  it('refuses a movement without amount, account or description', async () => {
    const bad = { ...lunch, accountId: '', amountMinor: 0, description: '  ' };
    await expect(manual.addManualTransaction(bad)).rejects.toThrow(InvalidManualTransactionError);
    await expect(manual.addManualTransaction(bad)).rejects.toMatchObject({
      problems: ['account', 'amount', 'description'],
    });
    await expect(manual.addManualTransaction({ ...lunch, amountMinor: 1.5 })).rejects.toThrow(
      InvalidManualTransactionError,
    );
    expect(await service.getTransactionsBetween('2026-01-01', '2026-12-31')).toEqual([]);
  });
});

describe('updateManualTransaction and deleteManualTransaction', () => {
  it('edits a manual movement and keeps its goal', async () => {
    await manual.addManualTransaction(lunch);
    await service.setTransactionGoal('manual-1', 'goal-1');
    const edited = await manual.updateManualTransaction('manual-1', {
      ...lunch,
      amountMinor: 3_000_000,
      description: 'Almuerzo con amigos',
    });
    expect(edited).toMatchObject({ amountMinor: -3_000_000, goalId: 'goal-1' });
    expect((await service.searchTransactions('amigos')).map((t) => t.id)).toEqual(['manual-1']);
    expect(await service.searchTransactions('corrient')).toEqual([]);
  });

  it('never edits or deletes a bank movement', async () => {
    await service.upsertFromSync({
      accountId: 'acc-ahorros',
      since: '2020-01-01T00:00:00Z',
      transactions: [bankTx({ id: 'bank-1', bookedAt: '2026-09-20T15:00:00Z' })],
    });
    await expect(manual.updateManualTransaction('bank-1', lunch)).rejects.toThrow(
      TransactionNotFoundError,
    );
    await expect(manual.deleteManualTransaction('bank-1')).rejects.toThrow(
      TransactionNotFoundError,
    );
    expect(await service.getTransaction('bank-1')).not.toBeNull();
  });

  it('deletes a manual movement', async () => {
    await manual.addManualTransaction(lunch);
    backup.clearDirty();
    await manual.deleteManualTransaction('manual-1');
    expect(await service.getTransaction('manual-1')).toBeNull();
    expect(await service.searchTransactions('almuerzo')).toEqual([]);
    expect(backup.dirty(MANUAL_COLLECTION)).toEqual(['manual-1']);
  });

  it('is never removed by a sync of the same account', async () => {
    await manual.addManualTransaction({ ...lunch, accountId: 'acc-ahorros' });
    await service.upsertFromSync({
      accountId: 'acc-ahorros',
      since: '2020-01-01T00:00:00Z',
      transactions: [],
    });
    expect(await service.getTransaction('manual-1')).not.toBeNull();
  });
});

describe('balances (team decision of 5 Nov 2026)', () => {
  const lunchEffect = { accountId: 'acc-cash', amountMinor: -2_500_000 };

  it('applies a new Gasto to its account with a minus sign, and an Ingreso with a plus', async () => {
    await manual.addManualTransaction(lunch);
    await manual.addManualTransaction({ ...lunch, kind: 'income', amountMinor: 1_000_000 });
    expect(applied).toEqual([
      { before: null, after: lunchEffect },
      { before: null, after: { accountId: 'acc-cash', amountMinor: 1_000_000 } },
    ]);
  });

  it('gives M6 the old and the new movement on an edit, also when the account changes', async () => {
    await manual.addManualTransaction(lunch);
    await manual.updateManualTransaction('manual-1', {
      ...lunch,
      accountId: 'acc-wallet',
      amountMinor: 3_000_000,
    });
    expect(applied[1]).toEqual({
      before: lunchEffect,
      after: { accountId: 'acc-wallet', amountMinor: -3_000_000 },
    });
  });

  it('takes the movement back on delete', async () => {
    await manual.addManualTransaction(lunch);
    await manual.deleteManualTransaction('manual-1');
    expect(applied[1]).toEqual({ before: lunchEffect, after: null });
  });

  it('saves nothing when M6 refuses the movement (Gasto bigger than the cash)', async () => {
    balances.apply.mockRejectedValueOnce(new Error('InsufficientCashError'));
    await expect(manual.addManualTransaction(lunch)).rejects.toThrow('InsufficientCashError');
    expect(await service.getTransaction('manual-1')).toBeNull();
    expect(backup.dirty(MANUAL_COLLECTION)).toEqual([]);
    expect(changed).not.toHaveBeenCalled();
  });

  it('keeps the movement when M6 refuses an edit or a delete', async () => {
    await manual.addManualTransaction(lunch);
    balances.apply.mockRejectedValueOnce(new Error('InsufficientCashError'));
    await expect(
      manual.updateManualTransaction('manual-1', { ...lunch, amountMinor: 90_000_000 }),
    ).rejects.toThrow();
    balances.apply.mockRejectedValueOnce(new Error('InsufficientCashError'));
    await expect(manual.deleteManualTransaction('manual-1')).rejects.toThrow();
    expect(await service.getTransaction('manual-1')).toMatchObject({ amountMinor: -2_500_000 });
  });

  it('gives the balance back when the movement cannot be saved or deleted', async () => {
    vault.close();
    vault = await build({
      manualStore: (s) => ({
        ...s,
        save: async () => Promise.reject(new Error('vault locked')),
        delete: async () => Promise.reject(new Error('vault locked')),
      }),
    });
    await expect(manual.addManualTransaction(lunch)).rejects.toThrow('vault locked');
    expect(applied).toEqual([
      { before: null, after: lunchEffect },
      { before: lunchEffect, after: null },
    ]);
  });

  it('never touches balances for a bank movement, a restore or a sync', async () => {
    await service.upsertFromSync({
      accountId: 'acc-ahorros',
      since: '2020-01-01T00:00:00Z',
      transactions: [bankTx({ id: 'bank-1', bookedAt: '2026-09-20T15:00:00Z' })],
    });
    await expect(manual.deleteManualTransaction('bank-1')).rejects.toThrow(
      TransactionNotFoundError,
    );
    await manual.addManualTransaction(lunch);
    const exported = await backup.exportAll();
    const phone = await build();
    balances.apply.mockClear();
    await backup.importAll(exported);
    expect(balances.apply).not.toHaveBeenCalled();
    phone.close();
  });
});

describe('transactions.manual backup', () => {
  it('brings manual movements and deletions to a new phone', async () => {
    await manual.addManualTransaction(lunch);
    await manual.addManualTransaction({ ...lunch, description: 'Taxi', amountMinor: 1_800_000 });
    await manual.deleteManualTransaction('manual-2');
    const exported = await backup.exportAll();
    expect(exported[MANUAL_COLLECTION]).toEqual([
      expect.objectContaining({ id: 'manual-1', version: 1, deleted: false }),
      { id: 'manual-2', version: 2, deleted: true, data: null },
    ]);

    const phone = await build();
    await backup.importAll(exported);
    expect(await service.getTransaction('manual-1')).toMatchObject({
      description: 'Almuerzo corrientazo',
      amountMinor: -2_500_000,
    });
    expect(await service.getTransaction('manual-2')).toBeNull();
    expect(await backup.exportAll()).toEqual(exported);
    phone.close();
  });

  it('never lets an older backup undo a newer change', async () => {
    await manual.addManualTransaction(lunch);
    const old = await manual.backupCollection.exportAll();
    await manual.updateManualTransaction('manual-1', { ...lunch, description: 'Almuerzo nuevo' });
    await manual.backupCollection.importAll(old);
    expect((await service.getTransaction('manual-1'))?.description).toBe('Almuerzo nuevo');
  });

  it('counts a goal or category change of a manual movement as a new version', async () => {
    await manual.addManualTransaction(lunch);
    await service.setTransactionGoal('manual-1', 'goal-1');
    backup.clearDirty();
    await manual.markChanged(['manual-1', 'bank-x']);
    expect(backup.dirty(MANUAL_COLLECTION)).toEqual(['manual-1']);
    const [record] = await manual.backupCollection.exportAll();
    expect(record).toMatchObject({ version: 2, data: { goalId: 'goal-1' } });
  });
});
