import { VAULT_DB_NAME, createOpSqliteDriver } from './opSqliteDriver';

function createFakeLibrary() {
  const db = {
    execute: jest.fn(async (_sql: string, _params?: unknown[]) => ({
      rowsAffected: 0,
      rows: [{ cipher_version: '4.5.7' }],
    })),
    closeAsync: jest.fn(async () => undefined),
    delete: jest.fn(),
  };
  const open = jest.fn((_options: Record<string, unknown>) => db);
  return { db, open, load: async () => ({ open }) as never };
}

const KEY = `x'${'ab'.repeat(32)}'`;

it('opens fynk-vault.db with the raw key as encryptionKey and turns foreign keys on', async () => {
  const { db, open, load } = createFakeLibrary();
  const driver = createOpSqliteDriver(load);
  await driver.open(KEY);
  expect(VAULT_DB_NAME).toBe('fynk-vault.db');
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith({ name: 'fynk-vault.db', encryptionKey: KEY });
  expect(db.execute.mock.calls).toEqual([['PRAGMA foreign_keys = ON']]);
});

it('runs statements with params and returns the rows', async () => {
  const { db, load } = createFakeLibrary();
  const driver = createOpSqliteDriver(load);
  await driver.open(KEY);
  expect(await driver.execute('PRAGMA cipher_version')).toEqual([{ cipher_version: '4.5.7' }]);
  await driver.execute('SELECT ?', [1]);
  expect(db.execute).toHaveBeenLastCalledWith('SELECT ?', [1]);
});

it('fails to run anything while closed', async () => {
  const { load } = createFakeLibrary();
  const driver = createOpSqliteDriver(load);
  await expect(driver.execute('SELECT 1')).rejects.toThrow('not open');
  await driver.open(KEY);
  await driver.close();
  await expect(driver.execute('SELECT 1')).rejects.toThrow('not open');
});

it('closes the connection', async () => {
  const { db, load } = createFakeLibrary();
  const driver = createOpSqliteDriver(load);
  await driver.open(KEY);
  await driver.close();
  expect(db.closeAsync).toHaveBeenCalledTimes(1);
});

it('deletes the file through the open connection', async () => {
  const { db, open, load } = createFakeLibrary();
  const driver = createOpSqliteDriver(load);
  await driver.open(KEY);
  await driver.deleteFile();
  expect(db.delete).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
});

it('deletes an existing file without a key when not open, and never creates one', async () => {
  const { db, open, load } = createFakeLibrary();
  await createOpSqliteDriver(load).deleteFile();
  expect(open).toHaveBeenCalledWith({ name: 'fynk-vault.db', failOnCreate: true });
  expect(db.delete).toHaveBeenCalledTimes(1);
});

it('treats a missing file as already deleted', async () => {
  const { open, load } = createFakeLibrary();
  open.mockImplementationOnce(() => {
    throw new Error('unable to open database file');
  });
  await expect(createOpSqliteDriver(load).deleteFile()).resolves.toBeUndefined();
});
