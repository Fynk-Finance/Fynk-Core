// The merchant catalog on the phone (SCRUM-58) on a real vault (sql.js): downloaded once a day
// with the ETag, kept in the vault, read when the vault opens, and looked up by merchant key.
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { recurringMigrations } from '../adapters/vault/migrations';
import { createVaultCatalogCache } from '../adapters/vault/vaultCatalogCache';
import type { CatalogEntry } from '../domain/catalog';
import type { CatalogApi } from './catalogPorts';
import { createCatalogService, type CatalogService } from './catalogService';

const clock = createFixedClock('2026-11-05T15:00:00Z');
const netflix: CatalogEntry = {
  key: 'netflix',
  displayName: 'Netflix',
  category: 'subscriptions',
  isSubscription: true,
  matchPatterns: ['netflix'],
  cancelUrl: 'https://www.netflix.com/cancelplan',
  cancelSteps: ['Entra a netflix.com e inicia sesión.'],
};

let vault: InMemoryVault;
let calls: (string | null)[];
let answer: Awaited<ReturnType<CatalogApi['fetch']>>;
let catalog: CatalogService;

const make = () =>
  createCatalogService({
    cache: () => createVaultCatalogCache(vault.db),
    api: {
      fetch: async (etag) => {
        calls.push(etag);
        return answer;
      },
    },
    clock,
  });

beforeEach(async () => {
  clock.set('2026-11-05T15:00:00Z');
  vault = await createInMemoryVault();
  vault.registerMigrations('recurring', recurringMigrations);
  await vault.migrate();
  calls = [];
  answer = { status: 'changed', etag: '"c1"', entries: [netflix] };
  catalog = make();
});

afterEach(() => vault.close());

describe('merchant catalog on the phone', () => {
  it('is empty before the first download, and nothing breaks', async () => {
    await catalog.load();
    expect(catalog.lookup('netflix')).toBeNull();
  });

  it('downloads it, keeps it in the vault and finds a merchant', async () => {
    expect(await catalog.refresh()).toBe(true);
    expect(catalog.lookup('cargo netflix com')?.displayName).toBe('Netflix');
    // Another start of the app reads it from the vault.
    const next = make();
    await next.load();
    expect(next.lookup('netflix')?.cancelUrl).toBe('https://www.netflix.com/cancelplan');
  });

  it('asks again at most once a day, with the ETag it has', async () => {
    await catalog.refresh();
    clock.set('2026-11-06T14:00:00Z');
    expect(await catalog.refresh()).toBe(false);
    expect(calls).toEqual([null]);

    clock.set('2026-11-06T15:00:00Z');
    answer = { status: 'unchanged' };
    expect(await catalog.refresh()).toBe(false);
    expect(calls).toEqual([null, '"c1"']);
    // A 304 keeps the copy and counts as today's check.
    expect(catalog.lookup('netflix')).not.toBeNull();
    clock.set('2026-11-06T20:00:00Z');
    await catalog.refresh();
    expect(calls).toHaveLength(2);
  });
});
