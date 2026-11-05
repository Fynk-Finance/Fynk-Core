// Public API of the accounts module: cash is registered with M2's encrypted backup as
// accounts.cash and every change is marked dirty there (HU-054 SCRUM-71, "respaldo").
import {
  createInMemoryBackupRegistry,
  createInMemoryVault,
  type InMemoryVault,
} from '@shared/testing';

const mockBackup = createInMemoryBackupRegistry();
const mockVault: { db?: InMemoryVault['db']; register: jest.Mock } = { register: jest.fn() };
let mockIds = 0;

jest.mock('@modules/vault', () => ({
  registerVaultMigrations: (...args: unknown[]) => mockVault.register(...args),
  getVaultDb: () => mockVault.db,
  registerBackupCollection: (...args: Parameters<typeof mockBackup.registerBackupCollection>) =>
    mockBackup.registerBackupCollection(...args),
  markDirty: (collection: string, id: string) => mockBackup.markDirty(collection, id),
}));
jest.mock('@modules/notifications', () => ({
  NOTIFICATIONS_ROUTE: 'notifications.Inbox',
  useUnreadCount: () => 0,
}));
jest.mock('@modules/transactions', () => ({
  NEW_TRANSACTION_ROUTE: 'transactions.New',
  TransactionList: () => null,
  TransactionPreview: () => null,
}));
jest.mock('@modules/analytics', () => ({ useMonthSummary: () => ({ data: undefined }) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `id-${++mockIds}` }));

let vault: InMemoryVault;
let accounts: typeof import('./index');

beforeAll(async () => {
  vault = await createInMemoryVault();
  mockVault.db = vault.db;
  // Loaded here, after the mocks exist: index.ts registers its tables and collection on load.
  accounts = jest.requireActual<typeof import('./index')>('./index');
  const [, migrations] = (mockVault.register.mock.calls as [string, never][]).find(
    ([module]) => module === 'accounts',
  )!;
  vault.registerMigrations('accounts', migrations);
  await vault.migrate();
});

afterAll(() => vault.close());

it('registers cash with the encrypted backup once, as accounts.cash', () => {
  expect(mockBackup.collections()).toEqual(['accounts.cash']);
});

it('marks the cash account and its history entry dirty on every change', async () => {
  await accounts.setCash(60_000_000);

  const [cash] = await vault.db.query<{ id: string }>(
    "SELECT id FROM accounts_accounts WHERE kind = 'cash'",
  );
  const history = await vault.db.query<{ id: string }>('SELECT id FROM accounts_cash_history');
  expect(mockBackup.dirty('accounts.cash').sort()).toEqual(
    [cash!.id, ...history.map((h) => h.id)].sort(),
  );
});

it('backs up and restores the cash it registered', async () => {
  const exported = await mockBackup.exportAll();
  expect(exported['accounts.cash']).not.toHaveLength(0);

  await vault.db.execute('DELETE FROM accounts_cash_history');
  await vault.db.execute("DELETE FROM accounts_accounts WHERE kind = 'cash'");
  expect(await accounts.getCash()).toBeNull();

  await mockBackup.importAll(exported);
  expect(await accounts.getCash()).toMatchObject({ amountMinor: 60_000_000 });
});
