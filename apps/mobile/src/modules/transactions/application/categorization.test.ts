// Categorization after a sync (HU-018 categorías predeterminadas): only the new ids, never a
// category the person picked, the person's overrides first, transactions.changed emitted.
import type { Transaction } from '@shared/domain/types';

import { transactionsMigrations } from '../adapters/vault/migrations';
import { createVaultTransactionsStore } from '../adapters/vault/vaultTransactionsStore';
import { bankTx } from '../testing/fixtures';
import { createNodeSqliteVault, type NodeSqliteVault } from '../testing/nodeSqliteVault';
import { createTransactionsService, type TransactionsService } from './transactionsService';

let vault: NodeSqliteVault;
let service: TransactionsService;
const emit = jest.fn();
let threshold = 2_000_000;

const sync = (transactions: Transaction[]) =>
  service.upsertFromSync({ accountId: 'acc-ahorros', since: '2020-01-01T00:00:00Z', transactions });
const categoryOf = async (id: string) => (await service.getTransaction(id))?.categoryId;

beforeEach(async () => {
  vault = createNodeSqliteVault();
  vault.registerMigrations('transactions', transactionsMigrations);
  await vault.migrate();
  emit.mockReset();
  threshold = 2_000_000;
  service = createTransactionsService({
    store: () => createVaultTransactionsStore(vault.db),
    events: { emit },
    treatsThreshold: async () => threshold,
  });
});

afterEach(() => vault.close());

describe('categorizeNew', () => {
  it('categorizes the new movements of a sync and tells the readers', async () => {
    const { newIds } = await sync([
      bankTx({
        id: 'market',
        bookedAt: '2026-09-21T15:00:00Z',
        description: 'SUPERMERCADO DEMO',
        amountMinor: -18_430_000,
      }),
      bankTx({
        id: 'coffee',
        bookedAt: '2026-09-21T16:00:00Z',
        description: 'CAFE Y ANTOJOS DEMO',
        merchantRaw: 'CAFE Y ANTOJOS DEMO',
        amountMinor: -980_000,
      }),
      bankTx({
        id: 'unknown',
        bookedAt: '2026-09-21T17:00:00Z',
        description: 'COMPRA POS 1234',
        merchantRaw: null,
      }),
    ]);
    expect(await service.categorizeNew(newIds)).toEqual(['market', 'coffee']);
    expect(await categoryOf('market')).toBe('groceries');
    expect(await categoryOf('coffee')).toBe('treats');
    expect(await categoryOf('unknown')).toBe('other');
    expect(emit).toHaveBeenCalledWith({ type: 'transactions.changed', ids: ['market', 'coffee'] });
  });

  it('uses the Antojos threshold of M10', async () => {
    threshold = 500_000;
    const { newIds } = await sync([
      bankTx({
        id: 'coffee',
        bookedAt: '2026-09-21T16:00:00Z',
        description: 'Café',
        merchantRaw: null,
        amountMinor: -980_000,
      }),
    ]);
    await service.categorizeNew(newIds);
    expect(await categoryOf('coffee')).toBe('restaurants');
  });

  it('never changes a category the person picked', async () => {
    await sync([bankTx({ id: 'market', bookedAt: '2026-09-21T15:00:00Z' })]);
    await vault.db.execute(
      "UPDATE transactions_transactions SET category_id = 'health', category_source = 'user'",
    );
    expect(await service.categorizeNew(['market'])).toEqual([]);
    expect(await categoryOf('market')).toBe('health');
    expect(emit).not.toHaveBeenCalled();
  });

  it('applies the person overrides by bank id and by merchant', async () => {
    await vault.db.execute(
      "INSERT INTO transactions_category_overrides VALUES ('juan valdez', 'restaurants', '2026-09-01T00:00:00Z', 1)",
    );
    await vault.db.execute(
      "INSERT INTO transactions_tx_overrides VALUES ('p-netflix', 'cinema', '2026-09-01T00:00:00Z', 1)",
    );
    const { newIds } = await sync([
      bankTx({
        id: 'coffee',
        bookedAt: '2026-09-21T16:00:00Z',
        description: 'JUAN VALDEZ',
        merchantRaw: 'JUAN VALDEZ',
        merchantKey: 'juan valdez',
        amountMinor: -980_000,
      }),
      bankTx({
        id: 'netflix',
        providerTxId: 'p-netflix',
        bookedAt: '2026-09-21T17:00:00Z',
        description: 'NETFLIX.COM',
        merchantRaw: null,
        merchantKey: null,
      }),
    ]);
    await service.categorizeNew(newIds);
    expect(await service.getTransaction('coffee')).toMatchObject({
      categoryId: 'restaurants',
      categorySource: 'user',
    });
    expect(await categoryOf('netflix')).toBe('cinema');
  });

  it('uses the merchant catalog of M9 after the person overrides and before the rules', async () => {
    const entries = { netflix: 'cinema', 'juan valdez': 'restaurants', epm: 'utilities' } as const;
    const catalog = jest.fn((key: string) => entries[key as keyof typeof entries] ?? null);
    service = createTransactionsService({
      store: () => createVaultTransactionsStore(vault.db),
      events: { emit },
      treatsThreshold: async () => threshold,
      catalogCategory: catalog,
    });
    await vault.db.execute(
      "INSERT INTO transactions_category_overrides VALUES ('epm', 'rent', '2026-09-01T00:00:00Z', 1)",
    );
    const { newIds } = await sync([
      // The rules say subscriptions; the catalog wins.
      bankTx({
        id: 'netflix',
        bookedAt: '2026-09-21T15:00:00Z',
        description: 'NETFLIX.COM',
        merchantRaw: 'NETFLIX.COM',
        merchantKey: 'netflix',
        amountMinor: -3_890_000,
      }),
      // Food under the Antojos threshold is still treats.
      bankTx({
        id: 'coffee',
        bookedAt: '2026-09-21T16:00:00Z',
        description: 'JUAN VALDEZ',
        merchantRaw: 'JUAN VALDEZ',
        merchantKey: 'juan valdez',
        amountMinor: -980_000,
      }),
      // The person's category for the merchant wins over the catalog.
      bankTx({
        id: 'epm',
        bookedAt: '2026-09-21T17:00:00Z',
        description: 'EPM SERVICIOS',
        merchantRaw: 'EPM',
        merchantKey: 'epm',
        amountMinor: -18_600_000,
      }),
      // No merchant key: the catalog is not asked and the rules decide.
      bankTx({
        id: 'market',
        bookedAt: '2026-09-21T18:00:00Z',
        description: 'SUPERMERCADO DEMO',
        merchantRaw: null,
        merchantKey: null,
        amountMinor: -18_430_000,
      }),
    ]);
    await service.categorizeNew(newIds);
    expect(await service.getTransaction('netflix')).toMatchObject({
      categoryId: 'cinema',
      categorySource: 'rule',
    });
    expect(await categoryOf('coffee')).toBe('treats');
    expect(await service.getTransaction('epm')).toMatchObject({
      categoryId: 'rent',
      categorySource: 'user',
    });
    expect(await categoryOf('market')).toBe('groceries');
    expect(catalog.mock.calls.map(([key]) => key).sort()).toEqual(['juan valdez', 'netflix']);
  });

  it('does nothing for no ids or unknown ids', async () => {
    expect(await service.categorizeNew([])).toEqual([]);
    expect(await service.categorizeNew(['nope'])).toEqual([]);
    expect(emit).not.toHaveBeenCalled();
  });
});
