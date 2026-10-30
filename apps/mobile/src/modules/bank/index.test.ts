// Public API of the bank module: its vault tables, the HU-008 revocation listener, and the rule
// that bank tokens are never backed up (00-shared-contracts.md, section 3.2).
import { createFixedClock, createInMemoryVault, type InMemoryVault } from '@shared/testing';

import type { ConsentRevokedListener } from '@modules/consents';

const mockVault: { db?: InMemoryVault['db']; register: jest.Mock } = { register: jest.fn() };
const mockConsents: { listener?: ConsentRevokedListener } = {};

jest.mock('@modules/vault', () => ({
  registerVaultMigrations: (...args: unknown[]) => mockVault.register(...args),
  getVaultDb: () => mockVault.db,
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

it('registers its vault tables and deletes the token of a revoked consent (HU-008)', async () => {
  // Loaded here, after the mocks exist: index.ts registers its tables and listener on load.
  const bank = jest.requireActual<typeof import('./index')>('./index');
  const [module, migrations] = mockVault.register.mock.calls[0] as [string, never];
  expect(module).toBe('bank');
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
});

it('never registers bank links or tokens for backup', () => {
  const offenders = sourceFiles(__dirname).filter((file) =>
    /registerBackupCollection|markDirty/.test(readFileSync(file, 'utf8')),
  );
  expect(offenders).toEqual([]);
});
