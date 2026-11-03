// Changing a category (HU-018 SCRUM-32): one movement or every movement of a merchant, the
// history, the overrides the next sync and a new phone use, and M10's totals following it.
import type { CategoryId, MoneyMinor, Transaction } from '@shared/domain/types';
import { createAppEvents } from '@shared/events/appEvents';
import { createFixedClock, createInMemoryBackupRegistry } from '@shared/testing';

import { transactionsMigrations } from '../adapters/vault/migrations';
import { createVaultCategoryStore } from '../adapters/vault/vaultCategoryStore';
import { createVaultTransactionsStore } from '../adapters/vault/vaultTransactionsStore';
import { InvalidCategoryError } from '../domain/categoryChange';
import { bankTx } from '../testing/fixtures';
import { createNodeSqliteVault, type NodeSqliteVault } from '../testing/nodeSqliteVault';
import { createCategoryService, type CategoryService } from './categoryService';
import {
  createTransactionsService,
  TransactionNotFoundError,
  type TransactionsService,
} from './transactionsService';

let vault: NodeSqliteVault;
let service: TransactionsService;
let categories: CategoryService;
let backup: ReturnType<typeof createInMemoryBackupRegistry>;
const events = createAppEvents();
const clock = createFixedClock('2026-09-21T15:00:00Z');

function build(v: NodeSqliteVault) {
  let n = 0;
  backup = createInMemoryBackupRegistry();
  service = createTransactionsService({
    store: () => createVaultTransactionsStore(v.db),
    events,
    treatsThreshold: async () => 2_000_000,
  });
  categories = createCategoryService({
    store: () => createVaultTransactionsStore(v.db),
    categories: () => createVaultCategoryStore(v.db),
    events,
    clock,
    newId: () => `change-${++n}`,
    markDirty: backup.markDirty,
  });
  backup.registerBackupCollection(categories.backupCollection);
}

async function newVault() {
  const v = createNodeSqliteVault();
  v.registerMigrations('transactions', transactionsMigrations);
  await v.migrate();
  return v;
}

const coffee = (id: string, bookedAt: string, amountMinor = -980_000): Transaction =>
  bankTx({
    id,
    bookedAt,
    description: 'JUAN VALDEZ',
    merchantRaw: 'JUAN VALDEZ',
    merchantKey: 'juan valdez',
    amountMinor,
    categoryId: 'treats',
  });

beforeEach(async () => {
  clock.set('2026-09-21T15:00:00Z');
  vault = await newVault();
  build(vault);
  await service.upsertFromSync({
    accountId: 'acc-ahorros',
    since: '2020-01-01T00:00:00Z',
    transactions: [
      coffee('c1', '2026-09-20T15:00:00Z'),
      coffee('c2', '2026-09-10T15:00:00Z'),
      coffee('c3', '2026-08-10T15:00:00Z'),
      bankTx({ id: 'market', bookedAt: '2026-09-15T15:00:00Z', categoryId: 'groceries' }),
    ],
  });
});

afterEach(() => vault.close());

describe('changeCategory', () => {
  it('changes one movement, keeps its history and leaves an override by bank id', async () => {
    const seen = jest.fn();
    const off = events.on('transactions.changed', seen);
    expect(await categories.changeCategory('c1', 'restaurants')).toEqual(['c1']);
    off();

    expect(await service.getTransaction('c1')).toMatchObject({
      categoryId: 'restaurants',
      categorySource: 'user',
    });
    expect((await service.getTransaction('c2'))?.categoryId).toBe('treats');
    expect(await categories.getCategoryHistory('c1')).toEqual([
      {
        id: 'change-1',
        transactionId: 'c1',
        from: 'treats',
        to: 'restaurants',
        changedAt: '2026-09-21T15:00:00.000Z',
      },
    ]);
    expect(seen).toHaveBeenCalledWith({ type: 'transactions.changed', ids: ['c1'] });
    expect(backup.dirty('transactions.category_overrides')).toEqual(['transaction:p-c1']);
  });

  it('applies to every movement of the merchant and to the next ones', async () => {
    const changed = await categories.changeCategory('c1', 'restaurants', {
      applyToMerchant: true,
    });
    expect(changed.sort()).toEqual(['c1', 'c2', 'c3']);
    expect((await service.getTransaction('market'))?.categoryId).toBe('groceries');
    expect(backup.dirty('transactions.category_overrides')).toEqual(['merchant:juan valdez']);

    // A new movement of the merchant comes with the next sync.
    const { newIds } = await service.upsertFromSync({
      accountId: 'acc-ahorros',
      since: '2026-09-21T00:00:00Z',
      transactions: [coffee('c4', '2026-09-22T15:00:00Z')],
    });
    await service.categorizeNew(newIds);
    expect(await service.getTransaction('c4')).toMatchObject({
      categoryId: 'restaurants',
      categorySource: 'user',
    });
  });

  it('keeps every change in the history, newest first', async () => {
    await categories.changeCategory('c1', 'restaurants');
    clock.set('2026-09-22T15:00:00Z');
    await categories.changeCategory('c1', 'other');
    expect((await categories.getCategoryHistory('c1')).map((c) => [c.from, c.to])).toEqual([
      ['restaurants', 'other'],
      ['treats', 'restaurants'],
    ]);
  });

  it('writes no history when the category stays the same', async () => {
    expect(await categories.changeCategory('c1', 'treats')).toEqual([]);
    expect(await categories.getCategoryHistory('c1')).toEqual([]);
    expect((await service.getTransaction('c1'))?.categorySource).toBe('user');
  });

  it('refuses unknown movements and categories', async () => {
    await expect(categories.changeCategory('nope', 'other')).rejects.toThrow(
      TransactionNotFoundError,
    );
    await expect(categories.changeCategory('c1', 'pizza' as CategoryId)).rejects.toThrow(
      InvalidCategoryError,
    );
  });
});

describe('transactions.category_overrides backup', () => {
  it('restores the overrides on a new phone, where the next sync applies them', async () => {
    await categories.changeCategory('c1', 'restaurants', { applyToMerchant: true });
    await categories.changeCategory('market', 'health');
    const exported = await backup.exportAll();
    expect(exported['transactions.category_overrides']).toEqual([
      {
        id: 'merchant:juan valdez',
        version: 1,
        deleted: false,
        data: {
          kind: 'merchant',
          key: 'juan valdez',
          categoryId: 'restaurants',
          updatedAt: '2026-09-21T15:00:00.000Z',
        },
      },
      expect.objectContaining({ id: 'transaction:p-market', version: 1 }),
    ]);

    // New phone: empty vault, restore, then the first sync brings the bank movements again.
    const phone = await newVault();
    build(phone);
    await backup.importAll(exported);
    const { newIds } = await service.upsertFromSync({
      accountId: 'acc-ahorros',
      since: '2020-01-01T00:00:00Z',
      transactions: [
        coffee('c1', '2026-09-20T15:00:00Z'),
        bankTx({ id: 'market', bookedAt: '2026-09-15T15:00:00Z', categoryId: 'other' }),
      ],
    });
    await service.categorizeNew(newIds);
    expect((await service.getTransaction('c1'))?.categoryId).toBe('restaurants');
    expect((await service.getTransaction('market'))?.categoryId).toBe('health');
    phone.close();
  });

  it('never lets an older backup undo a newer choice', async () => {
    await categories.changeCategory('c1', 'restaurants', { applyToMerchant: true });
    await categories.changeCategory('c1', 'other', { applyToMerchant: true });
    await categories.backupCollection.importAll([
      {
        id: 'merchant:juan valdez',
        version: 1,
        deleted: false,
        data: { kind: 'merchant', key: 'juan valdez', categoryId: 'cinema', updatedAt: 'x' },
      },
    ]);
    const [record] = await categories.backupCollection.exportAll();
    expect(record).toMatchObject({ version: 2, data: { categoryId: 'other' } });
  });
});

describe('M10 totals follow a recategorization (integration with an M10 stub)', () => {
  // Stands in for M10: recounts September's spending by category whenever movements change.
  function analyticsStub() {
    let totals = new Map<CategoryId, MoneyMinor>();
    const recount = async () => {
      const rows = await service.getTransactionsBetween('2026-09-01', '2026-09-30');
      const next = new Map<CategoryId, MoneyMinor>();
      for (const t of rows) {
        if (t.amountMinor < 0)
          next.set(t.categoryId, (next.get(t.categoryId) ?? 0) - t.amountMinor);
      }
      totals = next;
    };
    let pending: Promise<void> = Promise.resolve();
    const off = events.on('transactions.changed', () => {
      pending = recount();
    });
    return { recount, totals: () => totals, settled: () => pending, off };
  }

  it('moves the amount from the old category to the new one', async () => {
    const m10 = analyticsStub();
    await m10.recount();
    expect(m10.totals().get('treats')).toBe(1_960_000);
    expect(m10.totals().get('restaurants')).toBeUndefined();

    await categories.changeCategory('c1', 'restaurants', { applyToMerchant: true });
    await m10.settled();
    expect(m10.totals().get('treats')).toBeUndefined();
    expect(m10.totals().get('restaurants')).toBe(1_960_000);
    expect(m10.totals().get('groceries')).toBe(1_843_000);
    m10.off();
  });
});
