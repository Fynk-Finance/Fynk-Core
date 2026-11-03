// Manual movements: create, edit and delete; validation; the transactions.manual backup with
// deletions; and a sync never touching them.
import { createAppEvents } from '@shared/events/appEvents';
import { createInMemoryBackupRegistry } from '@shared/testing';

import { transactionsMigrations } from '../adapters/vault/migrations';
import { createVaultManualStore } from '../adapters/vault/vaultManualStore';
import { createVaultTransactionsStore } from '../adapters/vault/vaultTransactionsStore';
import { InvalidManualTransactionError, type ManualInput } from '../domain/manual';
import { bankTx } from '../testing/fixtures';
import { createNodeSqliteVault, type NodeSqliteVault } from '../testing/nodeSqliteVault';
import { createManualService, MANUAL_COLLECTION, type ManualService } from './manualService';
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

async function build() {
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
    manual: () => createVaultManualStore(v.db),
    events,
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
