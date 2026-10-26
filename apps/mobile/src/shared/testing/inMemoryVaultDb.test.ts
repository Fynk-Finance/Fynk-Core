import { createInMemoryVault, type InMemoryVault } from './inMemoryVaultDb';

describe('createInMemoryVault', () => {
  let vault: InMemoryVault;

  beforeEach(async () => {
    vault = await createInMemoryVault();
  });

  afterEach(() => {
    vault.close();
  });

  it('runs execute and query with bound parameters', async () => {
    await vault.db.execute(
      'CREATE TABLE savings_goals (id TEXT PRIMARY KEY, target INTEGER, done INTEGER)',
    );
    await vault.db.execute('INSERT INTO savings_goals VALUES (?, ?, ?)', ['g1', 500000000, false]);

    const rows = await vault.db.query<{ id: string; target: number; done: number }>(
      'SELECT * FROM savings_goals WHERE id = ?',
      ['g1'],
    );

    expect(rows).toEqual([{ id: 'g1', target: 500000000, done: 0 }]);
  });

  it('commits a transaction that succeeds', async () => {
    await vault.db.execute('CREATE TABLE savings_goals (id TEXT PRIMARY KEY)');

    const result = await vault.db.transaction(async (tx) => {
      await tx.execute('INSERT INTO savings_goals VALUES (?)', ['g1']);
      await tx.execute('INSERT INTO savings_goals VALUES (?)', ['g2']);
      return 'ok';
    });

    expect(result).toBe('ok');
    expect(await vault.db.query('SELECT id FROM savings_goals')).toHaveLength(2);
  });

  it('rolls back a transaction that throws', async () => {
    await vault.db.execute('CREATE TABLE savings_goals (id TEXT PRIMARY KEY)');

    await expect(
      vault.db.transaction(async (tx) => {
        await tx.execute('INSERT INTO savings_goals VALUES (?)', ['g1']);
        throw new Error('fail');
      }),
    ).rejects.toThrow('fail');

    expect(await vault.db.query('SELECT id FROM savings_goals')).toEqual([]);
  });

  it('runs concurrent transactions one after the other', async () => {
    await vault.db.execute('CREATE TABLE savings_goals (id TEXT PRIMARY KEY)');
    const insert = (id: string) =>
      vault.db.transaction(async (tx) => {
        await tx.execute('INSERT INTO savings_goals VALUES (?)', [id]);
        await Promise.resolve();
      });

    await Promise.all([insert('a'), insert('b'), insert('c')]);

    expect(await vault.db.query('SELECT id FROM savings_goals')).toHaveLength(3);
  });

  it('lets two modules use the same migration version without colliding', async () => {
    vault.registerMigrations('savings', [
      { version: 1, up: 'CREATE TABLE savings_goals (id TEXT PRIMARY KEY)' },
    ]);
    vault.registerMigrations('recurring', [
      { version: 1, up: 'CREATE TABLE recurring_items (id TEXT PRIMARY KEY)' },
      { version: 2, up: 'ALTER TABLE recurring_items ADD COLUMN low_use INTEGER' },
    ]);

    await vault.migrate();
    await vault.migrate(); // a second run applies nothing

    const applied = await vault.db.query<{ module: string; version: number }>(
      'SELECT module, version FROM vault_migrations ORDER BY module, version',
    );
    expect(applied).toEqual([
      { module: 'recurring', version: 1 },
      { module: 'recurring', version: 2 },
      { module: 'savings', version: 1 },
    ]);
  });

  it('applies migrations in version order even when registered out of order', async () => {
    vault.registerMigrations('accounts', [
      { version: 2, up: 'ALTER TABLE accounts_cash ADD COLUMN note TEXT' },
      { version: 1, up: 'CREATE TABLE accounts_cash (id TEXT PRIMARY KEY)' },
    ]);

    await vault.migrate();

    await vault.db.execute('INSERT INTO accounts_cash (id, note) VALUES (?, ?)', ['c1', null]);
    expect(await vault.db.query('SELECT * FROM accounts_cash')).toEqual([{ id: 'c1', note: null }]);
  });

  it('does not record a migration that fails', async () => {
    vault.registerMigrations('analytics', [{ version: 1, up: 'CREATE TABLE analytics_caps (' }]);

    await expect(vault.migrate()).rejects.toThrow();

    expect(await vault.db.query('SELECT * FROM vault_migrations')).toEqual([]);
  });

  it('rejects tables without the module prefix', () => {
    expect(() =>
      vault.registerMigrations('savings', [{ version: 1, up: 'CREATE TABLE goals (id TEXT)' }]),
    ).toThrow('tables of savings must start with "savings_"');
  });

  it('rejects duplicate versions, invalid versions and a second registration', () => {
    expect(() =>
      vault.registerMigrations('savings', [
        { version: 1, up: 'CREATE TABLE savings_a (id TEXT)' },
        { version: 1, up: 'CREATE TABLE savings_b (id TEXT)' },
      ]),
    ).toThrow('Duplicate migration version');
    expect(() =>
      vault.registerMigrations('savings', [{ version: 0, up: 'CREATE TABLE savings_a (id TEXT)' }]),
    ).toThrow('positive integers');

    vault.registerMigrations('savings', []);
    expect(() => vault.registerMigrations('savings', [])).toThrow('already registered');
  });

  it('rejects parameters SQLite cannot store', async () => {
    await vault.db.execute('CREATE TABLE savings_goals (id TEXT)');
    await expect(
      vault.db.execute('INSERT INTO savings_goals VALUES (?)', [{ id: 'x' }]),
    ).rejects.toThrow(TypeError);
  });
});
