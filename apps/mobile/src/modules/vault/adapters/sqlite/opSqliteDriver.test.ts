import { LEGACY_VAULT_DB_NAME, createOpSqliteDriver, vaultDbName } from './opSqliteDriver';

const SLOT = 'a1b2c3';
const NAME = `fynk-vault-${SLOT}.db`;

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

it('opens fynk-vault-<slot>.db with the raw key as encryptionKey and turns foreign keys on', async () => {
  const { db, open, load } = createFakeLibrary();
  const driver = createOpSqliteDriver(() => SLOT, load);
  await driver.open(KEY);
  expect(vaultDbName(SLOT)).toBe(NAME);
  expect(LEGACY_VAULT_DB_NAME).toBe('fynk-vault.db');
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith({ name: NAME, encryptionKey: KEY });
  expect(db.execute.mock.calls).toEqual([['PRAGMA foreign_keys = ON']]);
});

it('runs statements with params and returns the rows', async () => {
  const { db, load } = createFakeLibrary();
  const driver = createOpSqliteDriver(() => SLOT, load);
  await driver.open(KEY);
  expect(await driver.execute('PRAGMA cipher_version')).toEqual([{ cipher_version: '4.5.7' }]);
  await driver.execute('SELECT ?', [1]);
  expect(db.execute).toHaveBeenLastCalledWith('SELECT ?', [1]);
});

it('fails to run anything while closed', async () => {
  const { load } = createFakeLibrary();
  const driver = createOpSqliteDriver(() => SLOT, load);
  await expect(driver.execute('SELECT 1')).rejects.toThrow('not open');
  await driver.open(KEY);
  await driver.close();
  await expect(driver.execute('SELECT 1')).rejects.toThrow('not open');
});

it('closes the connection', async () => {
  const { db, load } = createFakeLibrary();
  const driver = createOpSqliteDriver(() => SLOT, load);
  await driver.open(KEY);
  await driver.close();
  expect(db.closeAsync).toHaveBeenCalledTimes(1);
});

it('deletes the file through the open connection', async () => {
  const { db, open, load } = createFakeLibrary();
  const driver = createOpSqliteDriver(() => SLOT, load);
  await driver.open(KEY);
  await driver.deleteFile();
  expect(db.delete).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledTimes(1);
});

it('deletes an existing file without a key when not open, and never creates one', async () => {
  const { db, open, load } = createFakeLibrary();
  await createOpSqliteDriver(() => SLOT, load).deleteFile();
  expect(open).toHaveBeenCalledWith({ name: NAME, failOnCreate: true });
  expect(db.delete).toHaveBeenCalledTimes(1);
});

it('treats a missing file as already deleted', async () => {
  const { open, load } = createFakeLibrary();
  open.mockImplementationOnce(() => {
    throw new Error('unable to open database file');
  });
  await expect(createOpSqliteDriver(() => SLOT, load).deleteFile()).resolves.toBeUndefined();
});

describe('one file per account', () => {
  it('resolves the slot on every open', async () => {
    const { open, load } = createFakeLibrary();
    let slot: string | null = 'aaa';
    const driver = createOpSqliteDriver(() => slot, load);
    await driver.open(KEY);
    await driver.close();
    slot = 'bbb';
    await driver.open(KEY);
    expect(open.mock.calls.map((c) => c[0].name)).toEqual([
      'fynk-vault-aaa.db',
      'fynk-vault-bbb.db',
    ]);
  });

  it('with no slot, open throws and deleteFile does nothing', async () => {
    const { open, load } = createFakeLibrary();
    const driver = createOpSqliteDriver(() => null, load);
    await expect(driver.open(KEY)).rejects.toThrow('no signed in account');
    await expect(driver.deleteFile()).resolves.toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });
});

it('deleteFile uses the removal slot when nobody is signed in', async () => {
  const { db, open, load } = createFakeLibrary();
  const driver = createOpSqliteDriver(
    () => null,
    load,
    () => 'last',
  );
  await driver.deleteFile();
  expect(open).toHaveBeenCalledWith({ name: 'fynk-vault-last.db', failOnCreate: true });
  expect(db.delete).toHaveBeenCalledTimes(1);
});
