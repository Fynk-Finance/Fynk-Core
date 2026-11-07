// Public API of the bank module: its vault tables, the HU-008 revocation listener, the sync
// wired to M6 and M7 (HU-010, HU-011), and the rule that bank tokens are never backed up
// (00-shared-contracts.md, section 3.2).
import type { AppEvent } from '@shared/events/appEvents';
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import type { ConsentRevokedListener } from '@modules/consents';

import type { BankApiPort } from './application/ports';
import { accountIdOf } from './domain/syncMapping';

const mockVault: { db?: InMemoryVault['db']; register: jest.Mock } = { register: jest.fn() };
const mockConsents: { listener?: ConsentRevokedListener } = {};
// M6 and M7 are the only writers of accounts and movements: the sync must go through them.
const mockAccounts = { upsertFromSync: jest.fn(), markLinkRevoked: jest.fn() };
const mockTransactions = { upsertFromSync: jest.fn() };
const mockNotify = jest.fn();
const mockBankApi: BankApiPort = {
  authorize: jest.fn(),
  exchange: jest.fn(),
  accounts: jest.fn(async () => [
    {
      providerAccountId: 'acc-1',
      kind: 'savings' as const,
      displayName: 'Banco Demo · Ahorros',
      currency: 'COP' as const,
      balanceMinor: 320_000_000,
      status: 'active' as const,
      isSimulated: true,
    },
  ]),
  transactions: jest.fn(async () => ({
    items: [
      {
        providerTxId: 'tx-1',
        bookedAt: '2026-10-20T15:00:00Z',
        amountMinor: -18_430_000,
        description: 'Supermercado',
        status: 'booked' as const,
      },
    ],
    nextCursor: null,
  })),
  refresh: jest.fn(),
};

jest.mock('@modules/vault', () => ({
  registerVaultMigrations: (...args: unknown[]) => mockVault.register(...args),
  getVaultDb: () => mockVault.db,
}));
jest.mock('@modules/accounts', () => mockAccounts);
jest.mock('@modules/transactions', () => mockTransactions);
jest.mock('@modules/notifications', () => ({ notificationsPort: { notify: mockNotify } }));
jest.mock('./adapters/bankApi', () => ({ createBankApi: () => mockBankApi }));
jest.mock('./adapters/providersApi', () => ({
  createProvidersApi: () => ({
    list: async () => [{ id: 'banco-demo', displayName: 'Banco Demo' }],
    simulatedEntities: async () => ['banco-demo'],
  }),
}));
jest.mock('@modules/consents', () => ({
  ...jest.requireActual<object>('@modules/consents'),
  onConsentRevoked: (listener: ConsentRevokedListener) => {
    mockConsents.listener = listener;
    return () => undefined;
  },
}));

// Node's fs and path, typed here because the app has no Node types (same as tokens.test.ts).
declare const __dirname: string;
const { readdirSync, readFileSync, statSync } = jest.requireActual<{
  readdirSync(path: string): string[];
  readFileSync(path: string, encoding: string): string;
  statSync(path: string): { isDirectory(): boolean };
}>('fs');
const { join } = jest.requireActual<{ join(...parts: string[]): string }>('path');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

let vault: InMemoryVault;

beforeEach(async () => {
  vault = await createInMemoryVault();
  mockVault.db = vault.db;
});

afterEach(() => vault.close());

it('registers its vault tables and ends the link of a revoked consent in M5 and M6 (HU-008)', async () => {
  // Loaded here, after the mocks exist: index.ts registers its tables and listener on load.
  const bank = jest.requireActual<typeof import('./index')>('./index');
  // Other modules it imports may register their own tables too.
  const calls = mockVault.register.mock.calls as [string, never][];
  const [, migrations] = calls.find(([module]) => module === 'bank')!;
  expect(calls.filter(([module]) => module === 'bank')).toHaveLength(1);
  vault.registerMigrations('bank', migrations);
  await vault.migrate();
  await vault.db.execute(
    `INSERT INTO bank_links (id, provider, consent_id, status, created_at)
     VALUES ('link-1', 'banco-demo', 'consent-1', 'active', '2026-10-29T15:00:00Z')`,
  );
  await vault.db.execute(
    `INSERT INTO bank_tokens VALUES ('link-1', 'access', 'refresh', '2026-10-29T15:05:00Z')`,
  );

  await mockConsents.listener?.({
    consentId: 'consent-1',
    provider: 'banco-demo',
    revokedAt: createFixedClock('2026-10-30T10:00:00Z').now().toISOString(),
  });

  expect(await bank.getLinks()).toMatchObject([{ id: 'link-1', status: 'revoked' }]);
  expect(await vault.db.query('SELECT * FROM bank_tokens')).toEqual([]);
  expect(mockAccounts.markLinkRevoked).toHaveBeenCalledWith('link-1');
});

it('never registers bank links or tokens for backup', () => {
  const offenders = sourceFiles(__dirname).filter((file) =>
    /registerBackupCollection|markDirty/.test(readFileSync(file, 'utf8')),
  );
  expect(offenders).toEqual([]);
});

it('syncs a linked bank through M6 and M7 and tells the app (HU-010, HU-011)', async () => {
  const bank = jest.requireActual<typeof import('./index')>('./index');
  const { appEvents } = jest.requireActual<typeof import('@shared/events/appEvents')>(
    '@shared/events/appEvents',
  );
  const calls = mockVault.register.mock.calls as [string, never][];
  vault.registerMigrations('bank', calls.find(([module]) => module === 'bank')![1]);
  await vault.migrate();
  await vault.db.execute(
    `INSERT INTO bank_links (id, provider, consent_id, status, created_at)
     VALUES ('link-1', 'banco-demo', 'consent-1', 'active', '2026-10-29T15:00:00Z')`,
  );
  await vault.db.execute(
    `INSERT INTO bank_tokens VALUES ('link-1', 'access', 'refresh', '2999-01-01T00:00:00Z')`,
  );
  mockAccounts.upsertFromSync.mockResolvedValue(undefined);
  mockTransactions.upsertFromSync.mockResolvedValue({ newIds: ['tx-new'] });
  const events: AppEvent[] = [];
  const stop = appEvents.on('sync.completed', (e) => events.push(e));

  const report = await bank.syncNow();
  stop();

  const accountId = accountIdOf('banco-demo', 'acc-1');
  expect(report).toEqual({
    status: 'done',
    links: [{ linkId: 'link-1', provider: 'banco-demo', kind: 'synced' }],
  });
  expect(mockAccounts.upsertFromSync).toHaveBeenCalledWith([
    expect.objectContaining({ id: accountId, linkId: 'link-1', balanceMinor: 320_000_000 }),
  ]);
  expect(mockTransactions.upsertFromSync).toHaveBeenCalledWith(
    expect.objectContaining({
      accountId,
      transactions: [expect.objectContaining({ amountMinor: -18_430_000 })],
    }),
  );
  expect(events).toEqual([
    expect.objectContaining({ linkIds: ['link-1'], newTransactionIds: ['tx-new'] }),
  ]);
  expect(mockNotify).toHaveBeenCalledWith(
    expect.objectContaining({ kind: 'sync_result', title: expect.stringContaining('Banco Demo') }),
  );
  const [link] = await bank.getLinks();
  expect(link?.lastSyncedAt).toEqual(expect.any(String));
});
