// The sync engine with an injected clock, a real SQLite vault and fakes for the API, M6 and M7
// (HU-010, HU-011, HU-008 on the phone; M5 prompt, Sync engine and Tests).
import { ApiError } from '@shared/api';
import type { AppEvent } from '@shared/events/appEvents';
import { VaultLockedError } from '@shared/ports';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { bankMigrations } from '../adapters/vault/migrations';
import { createVaultLinkStore } from '../adapters/vault/vaultLinkStore';
import { accountIdOf, transactionIdOf } from '../domain/syncMapping';
import type { AccountsSink, BankApiPort, RemoteTransaction, TransactionsSink } from './ports';
import { createSyncEngine } from './syncEngine';

const clock = createFixedClock('2026-10-29T15:00:00Z');
const ACC = accountIdOf('banco-demo', 'acc-1');

const savings = {
  providerAccountId: 'acc-1',
  kind: 'savings' as const,
  displayName: 'Banco Demo · Ahorros',
  currency: 'COP' as const,
  balanceMinor: 320_000_000,
  status: 'active' as const,
  isSimulated: true,
};
const tx = (id: string, status: 'booked' | 'pending' = 'booked'): RemoteTransaction => ({
  providerTxId: id,
  bookedAt: '2026-10-20T15:00:00Z',
  amountMinor: -18_430_000,
  description: 'Supermercado',
  status,
});

let vault: InMemoryVault;
let store: ReturnType<typeof createVaultLinkStore>;

beforeEach(async () => {
  clock.set('2026-10-29T15:00:00Z');
  vault = await createInMemoryVault();
  vault.registerMigrations('bank', bankMigrations);
  await vault.migrate();
  store = createVaultLinkStore(vault.db);
  await store.saveLink(
    { id: 'link-1', provider: 'banco-demo', consentId: 'c-1', createdAt: '2026-10-29T14:00:00Z' },
    { accessToken: 'at-1', refreshToken: 'rt-1', accessExpiresAt: '2026-10-29T16:00:00Z' },
  );
});

afterEach(() => vault.close());

function setup(api: Partial<BankApiPort> = {}) {
  const events: AppEvent[] = [];
  const known = new Set<string>();
  const bank: BankApiPort = {
    authorize: jest.fn(),
    exchange: jest.fn(),
    accounts: jest.fn(async () => [savings]),
    transactions: jest.fn(async () => ({ items: [tx('tx-1')], nextCursor: null })),
    refresh: jest.fn(async () => ({
      linkId: 'link-1',
      provider: 'banco-demo',
      accessToken: 'at-2',
      refreshToken: 'rt-2',
      expiresIn: 300,
    })),
    ...api,
  };
  const accounts: AccountsSink = {
    upsertFromSync: jest.fn(async () => undefined),
    markLinkRevoked: jest.fn(async () => undefined),
  };
  // Like M7's upsert: a movement id seen before is not new.
  const transactions: TransactionsSink = {
    upsertFromSync: jest.fn(async ({ transactions: list }) => {
      const newIds = list.map((t) => t.id).filter((id) => !known.has(id));
      newIds.forEach((id) => known.add(id));
      return { newIds };
    }),
  };
  const engine = createSyncEngine({
    api: bank,
    store: () => store,
    accounts: () => accounts,
    transactions: () => transactions,
    events: { emit: (e) => events.push(e) },
    clock,
  });
  return { engine, bank, accounts, transactions, events };
}

it('syncs 12 months the first time, writes accounts and movements, and reports what changed (HU-010)', async () => {
  const { engine, bank, accounts, transactions, events } = setup();

  const report = await engine.syncAll();

  expect(bank.accounts).toHaveBeenCalledWith('link-1', 'at-1');
  expect(bank.transactions).toHaveBeenCalledWith({
    linkId: 'link-1',
    accessToken: 'at-1',
    providerAccountId: 'acc-1',
    since: '2025-10-29T15:00:00.000Z',
  });
  expect(accounts.upsertFromSync).toHaveBeenCalledWith([
    expect.objectContaining({
      id: ACC,
      linkId: 'link-1',
      lastSyncedAt: '2026-10-29T15:00:00.000Z',
    }),
  ]);
  expect(transactions.upsertFromSync).toHaveBeenCalledWith({
    accountId: ACC,
    since: '2025-10-29T15:00:00.000Z',
    transactions: [
      expect.objectContaining({ id: transactionIdOf(ACC, 'tx-1'), categoryId: 'other' }),
    ],
  });
  expect(report.links).toEqual([{ linkId: 'link-1', provider: 'banco-demo', kind: 'synced' }]);
  expect(events).toEqual([
    {
      type: 'sync.completed',
      at: '2026-10-29T15:00:00.000Z',
      linkIds: ['link-1'],
      newTransactionIds: [transactionIdOf(ACC, 'tx-1')],
      changedAccountIds: [ACC],
    },
  ]);
  expect((await store.getLinks())[0]).toMatchObject({ lastSyncedAt: '2026-10-29T15:00:00.000Z' });
});

it('makes one network call for two pulls within 60 seconds (HU-011)', async () => {
  const { engine, bank } = setup();
  await engine.syncAll();
  clock.advance(59_000);
  const second = await engine.syncAll();
  expect(bank.accounts).toHaveBeenCalledTimes(1);
  expect(second.links).toEqual([{ linkId: 'link-1', provider: 'banco-demo', kind: 'cooldown' }]);
  clock.advance(1_000);
  await engine.syncAll();
  expect(bank.accounts).toHaveBeenCalledTimes(2);
});

it('shares one run between calls made while it is running', async () => {
  const { engine, bank } = setup();
  const [a, b] = await Promise.all([engine.syncAll(), engine.syncAll()]);
  expect(a).toBe(b);
  expect(bank.accounts).toHaveBeenCalledTimes(1);
});

it('asks only from 3 days before the last sync, and the overlap creates no duplicates (HU-011)', async () => {
  const { engine, bank, events } = setup();
  await engine.syncAll();
  clock.set('2026-10-30T09:00:00Z');
  await engine.syncAll();
  expect((bank.transactions as jest.Mock).mock.calls[1]![0]).toMatchObject({
    since: '2026-10-26T15:00:00.000Z',
  });
  const completed = events.filter((e) => e.type === 'sync.completed');
  expect(completed[1]).toMatchObject({ newTransactionIds: [] });
});

it('pages the movements by cursor', async () => {
  const pages = [
    { items: [tx('tx-1')], nextCursor: 'p2' },
    { items: [tx('tx-2', 'pending')], nextCursor: null },
  ];
  const { engine, bank, transactions } = setup({
    transactions: jest.fn(async () => pages.shift()!),
  });
  await engine.syncAll();
  expect((bank.transactions as jest.Mock).mock.calls[1]![0]).toMatchObject({ cursor: 'p2' });
  const [{ transactions: written }] = (transactions.upsertFromSync as jest.Mock).mock.calls[0]! as [
    { transactions: { providerTxId: string }[] },
  ];
  expect(written.map((t) => t.providerTxId)).toEqual(['tx-1', 'tx-2']);
});

it('renews an access token that is about to expire, and keeps the new one (HU-030)', async () => {
  await store.updateTokens('link-1', {
    accessToken: 'at-1',
    refreshToken: 'rt-1',
    accessExpiresAt: '2026-10-29T15:00:30Z',
  });
  const { engine, bank } = setup();
  await engine.syncAll();
  expect(bank.refresh).toHaveBeenCalledWith('link-1', 'rt-1');
  expect(bank.accounts).toHaveBeenCalledWith('link-1', 'at-2');
  expect(await store.getTokens('link-1')).toEqual({
    accessToken: 'at-2',
    refreshToken: 'rt-2',
    accessExpiresAt: '2026-10-29T15:05:00.000Z',
  });
});

it.each(['consent_revoked', 'link_not_found'])(
  'ends the link on %s: revoked, tokens deleted, M6 told, sync.failed (HU-008)',
  async (code) => {
    const { engine, accounts, events } = setup({
      accounts: jest.fn(async () =>
        Promise.reject(new ApiError({ status: 409, code, title: code })),
      ),
    });
    const report = await engine.syncAll();
    expect(report.links).toEqual([
      { linkId: 'link-1', provider: 'banco-demo', kind: 'revoked', code },
    ]);
    expect((await store.getLinks())[0]).toMatchObject({ status: 'revoked' });
    expect(await store.getTokens('link-1')).toBeNull();
    expect(accounts.markLinkRevoked).toHaveBeenCalledWith('link-1');
    expect(events).toEqual([
      { type: 'sync.failed', at: '2026-10-29T15:00:00.000Z', linkId: 'link-1', code },
    ]);
  },
);

it('never syncs a revoked link', async () => {
  await store.revokeLink('link-1', '2026-10-29T14:30:00Z');
  const { engine, bank, events } = setup();
  expect((await engine.syncAll()).links).toEqual([]);
  expect(bank.accounts).not.toHaveBeenCalled();
  expect(events).toEqual([]);
});

it('records a failure with its code and keeps the last update date (HU-010 "Errores registrados")', async () => {
  const { engine, events } = setup({
    transactions: jest.fn(async () => Promise.reject(ApiError.network())),
  });
  const report = await engine.syncAll();
  expect(report.links).toEqual([
    { linkId: 'link-1', provider: 'banco-demo', kind: 'failed', code: 'network_error' },
  ]);
  expect(events).toEqual([
    {
      type: 'sync.failed',
      at: '2026-10-29T15:00:00.000Z',
      linkId: 'link-1',
      code: 'network_error',
    },
  ]);
  expect((await store.getLinks())[0]).toMatchObject({
    lastSyncedAt: null,
    lastAttemptAt: '2026-10-29T15:00:00.000Z',
  });
});

it('stops asking the other links once the API says rate_limited (HU-011 "Límites de API")', async () => {
  await store.saveLink(
    {
      id: 'link-2',
      provider: 'billetera-demo',
      consentId: 'c-2',
      createdAt: '2026-10-29T14:10:00Z',
    },
    { accessToken: 'at-9', refreshToken: 'rt-9', accessExpiresAt: '2026-10-29T16:00:00Z' },
  );
  const { engine, bank } = setup({
    accounts: jest.fn(async () =>
      Promise.reject(new ApiError({ status: 429, code: 'rate_limited', title: 'x' })),
    ),
  });
  const report = await engine.syncAll();
  expect(bank.accounts).toHaveBeenCalledTimes(1);
  expect(report.links.map((l) => [l.linkId, l.kind, l.code])).toEqual([
    ['link-1', 'failed', 'rate_limited'],
    ['link-2', 'failed', 'rate_limited'],
  ]);
});

it('does nothing and reports locked while the vault is locked', async () => {
  const { engine } = setup();
  const locked = createSyncEngine({
    ...{
      api: {} as BankApiPort,
      accounts: () => ({}) as AccountsSink,
      transactions: () => ({}) as TransactionsSink,
    },
    store: () => {
      throw new VaultLockedError();
    },
    events: { emit: jest.fn() },
    clock,
  });
  expect(await locked.syncAll()).toEqual({ status: 'locked', links: [] });
  expect((await engine.syncAll()).status).toBe('done');
});
