import { bytesToHex } from '@noble/hashes/utils.js';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';

import { createAppEvents, type AppEvent } from '@shared/events/appEvents';
import { createFixedClock } from '@shared/testing';
import { VaultLockedError } from '@shared/ports/vault';

import { VaultNotEncryptedError, type DekStore, type VaultDriver } from './ports';
import { createVault, rawKey } from './vault';

const DEK = Uint8Array.from({ length: 32 }, (_, i) => i);
const DEK_HEX = bytesToHex(DEK);

interface TestDriver extends VaultDriver {
  calls: string[];
  keys: string[];
  deleted: number;
}

// A real SQLite through sql.js. SQLCipher is native, so cipher_version is answered by hand.
// Closing keeps the data, like closing and reopening the same file.
async function createSqlJsDriver(cipherVersion: string | null = '4.5.7'): Promise<TestDriver> {
  const SQL = await initSqlJs();
  let file = new SQL.Database();
  let database: Database | null = null;
  const driver: TestDriver = {
    calls: [],
    keys: [],
    deleted: 0,
    async open(key) {
      driver.keys.push(key);
      database = file;
    },
    async execute(sql, params) {
      driver.calls.push(sql);
      if (!database) throw new Error('closed');
      if (sql === 'PRAGMA cipher_version') {
        return cipherVersion === null ? [] : [{ cipher_version: cipherVersion }];
      }
      if (!params) {
        return database
          .exec(sql)
          .flatMap(({ columns, values }) =>
            values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]]))),
          );
      }
      const statement = database.prepare(sql);
      try {
        statement.bind(params as SqlValue[]);
        const rows = [];
        while (statement.step()) rows.push(statement.getAsObject());
        return rows;
      } finally {
        statement.free();
      }
    },
    async close() {
      driver.calls.push('close');
      database = null;
    },
    async deleteFile() {
      driver.calls.push('deleteFile');
      driver.deleted++;
      file = new SQL.Database();
    },
  };
  return driver;
}

function createDekStore(): DekStore & { removed: string[] } {
  const removed: string[] = [];
  return {
    removed,
    read: async () => null,
    write: async () => undefined,
    remove: async () => void removed.push('A'),
    removeAll: async () => void removed.push('A', 'B'),
  };
}

async function setup(cipherVersion?: string | null) {
  const driver = await createSqlJsDriver(cipherVersion);
  const dekStore = createDekStore();
  const events = createAppEvents();
  const seen: AppEvent['type'][] = [];
  events.on('vault.unlocked', () => seen.push('vault.unlocked'));
  events.on('vault.locked', () => seen.push('vault.locked'));
  const clock = createFixedClock('2026-10-28T15:00:00.000Z');
  return { driver, dekStore, seen, vault: createVault({ driver, dekStore, events, clock }) };
}

const goals = [
  { version: 1, up: 'CREATE TABLE savings_goals (id TEXT PRIMARY KEY, name TEXT NOT NULL);' },
  { version: 2, up: 'ALTER TABLE savings_goals ADD COLUMN target INTEGER;' },
];

describe('open', () => {
  it('gives the driver the DEK in SQLCipher raw key form', async () => {
    const { vault, driver } = await setup();
    await vault.open(DEK);
    expect(driver.keys).toEqual([`x'${DEK_HEX}'`]);
    expect(rawKey(DEK)).toBe(`x'${DEK_HEX}'`);
  });

  it('applies migrations once, in order, and tracks them with the clock', async () => {
    const { vault } = await setup();
    vault.registerVaultMigrations('savings', [goals[1]!, goals[0]!]);
    vault.registerVaultMigrations('recurring', [
      { version: 1, up: 'CREATE TABLE recurring_items (id TEXT PRIMARY KEY);' },
    ]);
    await vault.open(DEK);
    const db = vault.getVaultDb();
    expect(
      await db.query('SELECT module, version, applied_at FROM vault_migrations ORDER BY rowid'),
    ).toEqual([
      { module: 'savings', version: 1, applied_at: '2026-10-28T15:00:00.000Z' },
      { module: 'savings', version: 2, applied_at: '2026-10-28T15:00:00.000Z' },
      { module: 'recurring', version: 1, applied_at: '2026-10-28T15:00:00.000Z' },
    ]);
    await db.execute('INSERT INTO savings_goals (id, name, target) VALUES (?, ?, ?)', [
      'g',
      'x',
      5,
    ]);
  });

  it('does not apply them again when the vault is reopened', async () => {
    const { vault, driver } = await setup();
    vault.registerVaultMigrations('savings', goals);
    await vault.open(DEK);
    await vault.getVaultDb().execute("INSERT INTO savings_goals (id, name) VALUES ('g', 'x')");
    await vault.close();
    driver.calls.length = 0;
    await vault.open(DEK);
    expect(driver.calls.filter((c) => c.includes('ALTER TABLE'))).toEqual([]);
    expect(await vault.getVaultDb().query('SELECT id FROM savings_goals')).toEqual([{ id: 'g' }]);
  });

  it('rolls a failed migration back with its tracking row and stops opening', async () => {
    const { vault, driver } = await setup();
    vault.registerVaultMigrations('savings', [
      { version: 1, up: 'CREATE TABLE savings_goals (id TEXT); NOT SQL;' },
    ]);
    await expect(vault.open(DEK)).rejects.toThrow();
    expect(vault.isOpen()).toBe(false);
    expect(driver.calls.at(-1)).toBe('close');
    expect(() => vault.getVaultDb()).toThrow(VaultLockedError);
  });

  it('applies the migrations of a module that registers while open', async () => {
    const { vault } = await setup();
    await vault.open(DEK);
    vault.registerVaultMigrations('savings', goals);
    await vault.getVaultDb().transaction(async () => undefined); // waits for the queue
    expect(await vault.getVaultDb().query('SELECT version FROM vault_migrations')).toEqual([
      { version: 1 },
      { version: 2 },
    ]);
  });

  it('emits vault.unlocked, and vault.locked on close', async () => {
    const { vault, seen } = await setup();
    await vault.open(DEK);
    await vault.open(DEK);
    await vault.close();
    await vault.close();
    expect(seen).toEqual(['vault.unlocked', 'vault.locked']);
  });

  it('rejects a DEK that is not 32 bytes before touching the driver', async () => {
    const { vault, driver } = await setup();
    await expect(vault.open(new Uint8Array(16))).rejects.toThrow(RangeError);
    expect(driver.keys).toEqual([]);
  });
});

describe('encryption guard', () => {
  it.each([[null], [''], ['  ']])(
    'refuses to continue when cipher_version is %j',
    async (version) => {
      const { vault, driver, seen } = await setup(version);
      vault.registerVaultMigrations('savings', goals);
      await expect(vault.open(DEK)).rejects.toThrow(VaultNotEncryptedError);
      // Nothing but the check ran, then the driver was closed.
      expect(driver.calls).toEqual(['PRAGMA cipher_version', 'close']);
      expect(vault.isOpen()).toBe(false);
      expect(seen).toEqual([]);
    },
  );
});

describe('getVaultDb', () => {
  it('throws VaultLockedError while the vault is closed', async () => {
    const { vault } = await setup();
    expect(() => vault.getVaultDb()).toThrow(VaultLockedError);
    await vault.open(DEK);
    await vault.close();
    expect(() => vault.getVaultDb()).toThrow(VaultLockedError);
  });

  it('serializes transactions and rolls back on error', async () => {
    const { vault } = await setup();
    vault.registerVaultMigrations('savings', goals);
    await vault.open(DEK);
    const db = vault.getVaultDb();
    const order: string[] = [];
    const first = db.transaction(async (tx) => {
      await tx.execute("INSERT INTO savings_goals (id, name) VALUES ('a', 'a')");
      await new Promise((r) => setTimeout(r, 10));
      order.push('first');
      throw new Error('boom');
    });
    const second = db.transaction(async (tx) => {
      order.push('second');
      await tx.execute("INSERT INTO savings_goals (id, name) VALUES ('b', 'b')");
    });
    await expect(first).rejects.toThrow('boom');
    await second;
    expect(order).toEqual(['first', 'second']);
    expect(await db.query('SELECT id FROM savings_goals')).toEqual([{ id: 'b' }]);
  });

  it('runs a statement outside a transaction after it, so a rollback never takes it along', async () => {
    const { vault } = await setup();
    vault.registerVaultMigrations('savings', goals);
    await vault.open(DEK);
    const db = vault.getVaultDb();
    const failing = db.transaction(async (tx) => {
      await tx.execute("INSERT INTO savings_goals (id, name) VALUES ('a', 'a')");
      await new Promise((r) => setTimeout(r, 10));
      throw new Error('boom');
    });
    const outside = db.execute("INSERT INTO savings_goals (id, name) VALUES ('c', 'c')");
    await expect(failing).rejects.toThrow('boom');
    await outside;
    expect(await db.query('SELECT id FROM savings_goals')).toEqual([{ id: 'c' }]);
  });

  it('makes a kept VaultDb throw VaultLockedError once the vault is closed', async () => {
    const { vault } = await setup();
    await vault.open(DEK);
    const db = vault.getVaultDb();
    await vault.close();
    await expect(db.query('SELECT 1')).rejects.toThrow(VaultLockedError);
    await expect(db.transaction(async () => undefined)).rejects.toThrow(VaultLockedError);
  });
});

describe('registerVaultMigrations', () => {
  it('rejects a table without the module prefix', async () => {
    const { vault } = await setup();
    expect(() =>
      vault.registerVaultMigrations('savings', [
        { version: 1, up: 'CREATE TABLE goals (id TEXT);' },
      ]),
    ).toThrow(/must start with "savings_"/);
  });

  it('rejects duplicate and non-positive versions, and a second registration', async () => {
    const { vault } = await setup();
    const up = 'CREATE TABLE savings_a (id TEXT);';
    expect(() =>
      vault.registerVaultMigrations('savings', [
        { version: 1, up },
        { version: 1, up },
      ]),
    ).toThrow(/Duplicate/);
    expect(() => vault.registerVaultMigrations('savings', [{ version: 0, up }])).toThrow(
      /positive integers/,
    );
    vault.registerVaultMigrations('savings', [{ version: 1, up }]);
    expect(() => vault.registerVaultMigrations('savings', [{ version: 2, up }])).toThrow(
      /already registered/,
    );
  });
});

describe('wipe', () => {
  it('closes, deletes the file and both key copies, and emits vault.locked', async () => {
    const { vault, driver, dekStore, seen } = await setup();
    vault.registerVaultMigrations('savings', goals);
    await vault.open(DEK);
    await vault.wipe();
    expect(driver.calls.slice(-2)).toEqual(['close', 'deleteFile']);
    expect(dekStore.removed).toEqual(['A', 'B']);
    expect(seen).toEqual(['vault.unlocked', 'vault.locked']);
    expect(() => vault.getVaultDb()).toThrow(VaultLockedError);
    // The next open starts from nothing.
    await vault.open(DEK);
    expect(await vault.getVaultDb().query('SELECT count(*) AS n FROM savings_goals')).toEqual([
      { n: 0 },
    ]);
  });

  it('still removes both key copies when deleting the file fails', async () => {
    const { vault, driver, dekStore, seen } = await setup();
    driver.deleteFile = async () => {
      throw new Error('disk busy');
    };
    await expect(vault.wipe()).rejects.toThrow('disk busy');
    expect(dekStore.removed).toEqual(['A', 'B']);
    expect(seen).toEqual(['vault.locked']);
  });

  it('is a safe no-op for the file when the vault was never opened, and still clears the keys', async () => {
    const { vault, driver, dekStore, seen } = await setup();
    await vault.wipe();
    expect(driver.deleted).toBe(1);
    expect(dekStore.removed).toEqual(['A', 'B']);
    expect(seen).toEqual(['vault.locked']);
  });
});
