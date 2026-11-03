// Search (HU-017 SCRUM-31): partial words, no case or accents, relevant results, fast, and the
// index follows every write. Runs on node:sqlite, which has FTS5 like the phone's SQLCipher.
import type { Transaction } from '@shared/domain/types';

import { transactionsMigrations } from '../adapters/vault/migrations';
import { createVaultTransactionsStore } from '../adapters/vault/vaultTransactionsStore';
import { bankTx } from '../testing/fixtures';
import { createNodeSqliteVault, type NodeSqliteVault } from '../testing/nodeSqliteVault';
import { createTransactionsService, type TransactionsService } from './transactionsService';

let vault: NodeSqliteVault;
let service: TransactionsService;

const sync = (transactions: Transaction[], since = '2020-01-01T00:00:00Z') =>
  service.upsertFromSync({ accountId: 'acc-ahorros', since, transactions });
const ids = async (text: string) => (await service.searchTransactions(text)).map((t) => t.id);

beforeEach(async () => {
  vault = createNodeSqliteVault();
  vault.registerMigrations('transactions', transactionsMigrations);
  await vault.migrate();
  service = createTransactionsService({
    store: () => createVaultTransactionsStore(vault.db),
    events: { emit: jest.fn() },
    treatsThreshold: async () => 2_000_000,
  });
  await sync([
    bankTx({
      id: 'super',
      bookedAt: '2026-09-21T15:00:00Z',
      description: 'COMPRA POS',
      merchantRaw: 'Supermercado',
    }),
    bankTx({
      id: 'cafe',
      bookedAt: '2026-09-20T15:00:00Z',
      description: 'Café Señor Juan Valdez',
      merchantRaw: null,
    }),
    bankTx({
      id: 'super-old',
      bookedAt: '2026-08-02T15:00:00Z',
      description: 'SUPERMERCADO DEMO',
      merchantRaw: 'SUPERMERCADO DEMO',
    }),
    bankTx({
      id: 'tienda',
      bookedAt: '2026-09-19T15:00:00Z',
      description: 'Tienda de barrio',
      merchantRaw: null,
    }),
  ]);
});

afterEach(() => vault.close());

describe('searchTransactions', () => {
  it('finds "Supermercado" with "SUPERMERC" and with "supermércado", newest first', async () => {
    expect(await ids('SUPERMERC')).toEqual(['super', 'super-old']);
    expect(await ids('supermércado')).toEqual(['super', 'super-old']);
  });

  it('finds partial words in the description or the merchant, without accents or case', async () => {
    expect(await ids('cafe senor')).toEqual(['cafe']);
    expect(await ids('VALD')).toEqual(['cafe']);
    expect(await ids('pos')).toEqual(['super']);
  });

  it('needs every word, so results are relevant', async () => {
    expect(await ids('tienda barrio')).toEqual(['tienda']);
    expect(await ids('tienda netflix')).toEqual([]);
  });

  it('treats search syntax as plain text and gives nothing for an empty search', async () => {
    expect(await ids('("super*')).toEqual(['super', 'super-old']);
    expect(await ids('super OR netflix')).toEqual([]);
    expect(await ids('   ')).toEqual([]);
  });

  it('combines with the filters of the list', async () => {
    const page = await service.queryTransactions({
      text: 'super',
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(page.items.map((t) => t.id)).toEqual(['super']);
    expect(await service.summarize({ text: 'super' })).toMatchObject({ count: 2 });
  });

  it('follows updates and deletes', async () => {
    await sync([
      bankTx({
        id: 'tienda',
        bookedAt: '2026-09-19T15:00:00Z',
        description: 'Panadería La Espiga',
        merchantRaw: null,
      }),
      bankTx({
        id: 'pending',
        bookedAt: '2026-09-22T15:00:00Z',
        description: 'Netflix',
        status: 'pending',
      }),
    ]);
    expect(await ids('tienda')).toEqual([]);
    expect(await ids('panaderia')).toEqual(['tienda']);
    expect(await ids('netflix')).toEqual(['pending']);
    // The bank no longer returns the pending movement: it leaves the vault and the index.
    await sync([], '2026-09-22T00:00:00Z');
    expect(await ids('netflix')).toEqual([]);
  });

  it('indexes movements saved before the search index existed', async () => {
    const old = createNodeSqliteVault();
    old.registerMigrations('transactions', [transactionsMigrations[0]!]);
    await old.migrate();
    await createVaultTransactionsStore(old.db).upsertSynced({
      accountId: 'acc-ahorros',
      since: '2020-01-01T00:00:00.000Z',
      transactions: [
        bankTx({ id: 'before', bookedAt: '2026-01-01T15:00:00.000Z', description: 'Droguería' }),
      ],
    });
    await old.db.execute(transactionsMigrations[1]!.up);
    const rows = await createVaultTransactionsStore(old.db).list({ match: '"drogueria"*' });
    expect(rows.map((t) => t.id)).toEqual(['before']);
    old.close();
  });

  it('answers in under 300 ms with 12 months of movements (Gate C)', async () => {
    const words = [
      'Supermercado',
      'Restaurante',
      'Transmilenio',
      'Droguería',
      'Panadería',
      'Gimnasio',
    ];
    const start = Date.parse('2026-09-22T15:00:00Z');
    const many = Array.from({ length: 3000 }, (_, i) =>
      bankTx({
        id: `bulk-${i}`,
        bookedAt: new Date(start - i * 3 * 3_600_000).toISOString(),
        description: `${words[i % words.length]} sucursal ${i}`,
        merchantRaw: null,
      }),
    );
    await sync(many);
    const began = performance.now();
    const page = await service.queryTransactions({ text: 'drog' });
    const summary = await service.summarize({ text: 'drog' });
    const elapsed = performance.now() - began;
    expect(page.items).toHaveLength(20);
    expect(summary.count).toBe(500);
    expect(elapsed).toBeLessThan(300);
  });
});
