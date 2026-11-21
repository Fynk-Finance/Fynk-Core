import { createNodeSqliteVault } from './nodeSqliteVault';

describe('createNodeSqliteVault', () => {
  it('runs SQL, transactions and FTS5 with accent folding', async () => {
    const vault = createNodeSqliteVault();
    vault.registerMigrations('transactions', [
      {
        version: 1,
        up: `CREATE TABLE transactions_t (id TEXT PRIMARY KEY, d TEXT);
             CREATE VIRTUAL TABLE transactions_f USING fts5 (d, content='transactions_t',
               content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');`,
      },
    ]);
    await vault.migrate();
    await vault.db.transaction(async (tx) => {
      await tx.execute('INSERT INTO transactions_t VALUES (?, ?)', ['a', 'Café Señor']);
    });
    await vault.db.execute("INSERT INTO transactions_f (transactions_f) VALUES ('rebuild')");
    const rows = await vault.db.query<{ id: string }>(
      'SELECT t.id FROM transactions_f f JOIN transactions_t t ON t.rowid = f.rowid WHERE transactions_f MATCH ?',
      ['"senor"*'],
    );
    expect(rows).toEqual([{ id: 'a' }]);
    vault.close();
  });

  it('rolls back a failed transaction', async () => {
    const vault = createNodeSqliteVault();
    vault.registerMigrations('transactions', [
      { version: 1, up: 'CREATE TABLE transactions_t (id TEXT PRIMARY KEY)' },
    ]);
    await vault.migrate();
    await expect(
      vault.db.transaction(async (tx) => {
        await tx.execute('INSERT INTO transactions_t VALUES (?)', ['a']);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await vault.db.query('SELECT id FROM transactions_t')).toEqual([]);
    vault.close();
  });

  it('refuses a table without the module prefix', () => {
    const vault = createNodeSqliteVault();
    expect(() =>
      vault.registerMigrations('transactions', [{ version: 1, up: 'CREATE TABLE other (id)' }]),
    ).toThrow(/must start with "transactions_"/);
    vault.close();
  });
});
