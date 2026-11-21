// Migration 3 widens the provider CHECK of accounts_accounts (Banco Digital Demo, Cooperativa
// Demo) by rebuilding the table. Rows, columns and indexes must survive.
import { createInMemoryVault, type InMemoryVault } from '@shared/testing';

import { accountsMigrations } from './migrations';

let vault: InMemoryVault;

const insert = (id: string, provider: string, providerAccountId: string | null, kind = 'savings') =>
  vault.db.execute(
    `INSERT INTO accounts_accounts (id, provider, provider_account_id, kind, display_name, currency,
       balance_minor, status, is_simulated, created_at)
     VALUES (?, ?, ?, ?, 'x', 'COP', 100, 'active', 1, '2026-10-29T15:00:00Z')`,
    [id, provider, providerAccountId, kind],
  );

beforeEach(async () => {
  vault = await createInMemoryVault();
  // Versions 1 and 2 only, then the rows, then version 3 on its own.
  vault.registerMigrations(
    'accounts',
    accountsMigrations.filter((m) => m.version < 3),
  );
  await vault.migrate();
  await insert('a1', 'banco-demo', 'p1');
  await insert('cash', 'manual', null, 'cash');
  await vault.db.execute('UPDATE accounts_accounts SET backup_version = 4 WHERE id = ?', ['cash']);
  const v3 = accountsMigrations.find((m) => m.version === 3);
  if (!v3) throw new Error('migration 3 is missing');
  // The test vault's execute runs one statement, so split the script (it has no ';' inside).
  await vault.db.transaction(async (tx) => {
    for (const statement of v3.up.split(';').filter((s) => s.trim())) {
      await tx.execute(statement);
    }
  });
});

afterEach(() => vault.close());

it('keeps the existing rows, including backup_version', async () => {
  const rows = await vault.db.query<{ id: string; backup_version: number }>(
    'SELECT id, backup_version FROM accounts_accounts ORDER BY id',
  );
  expect(rows).toEqual([
    { id: 'a1', backup_version: 0 },
    { id: 'cash', backup_version: 4 },
  ]);
});

it.each(['banco-digital-demo', 'cooperativa-demo'])('accepts a %s account', async (provider) => {
  await insert('n1', provider, 'p9');
  const rows = await vault.db.query('SELECT id FROM accounts_accounts WHERE provider = ?', [
    provider,
  ]);
  expect(rows).toHaveLength(1);
});

it('still rejects an unknown provider', async () => {
  await expect(insert('n1', 'nope', 'p9')).rejects.toThrow();
});

it('keeps the unique indexes: one row per (provider, account) and a single cash account', async () => {
  await expect(insert('dup', 'banco-demo', 'p1')).rejects.toThrow();
  await expect(insert('cash2', 'manual', null, 'cash')).rejects.toThrow();
  await insert('other', 'cooperativa-demo', 'p1');
  const indexes = await vault.db.query<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'accounts_accounts' AND name LIKE 'accounts_accounts_%' ORDER BY name",
  );
  expect(indexes.map((i) => i.name)).toEqual([
    'accounts_accounts_link',
    'accounts_accounts_provider_key',
    'accounts_accounts_single_cash',
  ]);
});
