// The vault engine: opens the encrypted database, runs each module's migrations and serves
// getVaultDb(). Lock states, AppState and the lock screen come in the next PR.
import { bytesToHex } from '@noble/hashes/utils.js';
import type { Clock, ModuleName } from '@shared/domain/types';
import type { AppEvents } from '@shared/events/appEvents';
import {
  VaultLockedError,
  type VaultDb,
  type VaultMigration,
  type VaultTx,
} from '@shared/ports/vault';

import { KEY_LENGTH } from '../domain/crypto';
import { VaultNotEncryptedError, type DekStore, type VaultDriver } from './ports';

export interface Vault {
  /** Opens the database with the DEK and applies every pending migration. */
  open(dek: Uint8Array): Promise<void>;
  close(): Promise<void>;
  isOpen(): boolean;
  /** Same contract as GetVaultDb: throws VaultLockedError while closed. */
  getVaultDb(): VaultDb;
  /** Same contract as RegisterVaultMigrations. Applied right away when the vault is open. */
  registerVaultMigrations(module: ModuleName, migrations: VaultMigration[]): void;
  /** Closes, deletes the file and both DEK copies. Safe when the vault was never opened. */
  wipe(): Promise<void>;
}

export interface VaultDeps {
  driver: VaultDriver;
  dekStore: DekStore;
  events: AppEvents;
  clock: Clock;
}

const CREATE_TABLE = /create\s+(?:virtual\s+)?table\s+(?:if\s+not\s+exists\s+)?["`[]?(\w+)/gi;

// Contract rule: every table of a module is prefixed with the module name.
function assertTablePrefix(module: ModuleName, migration: VaultMigration): void {
  for (const match of migration.up.matchAll(CREATE_TABLE)) {
    const table = match[1] ?? '';
    if (!table.startsWith(`${module}_`)) {
      throw new Error(
        `Migration ${module}@${migration.version} creates table "${table}": tables of ${module} must start with "${module}_"`,
      );
    }
  }
}

/** SQLCipher raw key form: the 32 bytes are the key itself, no passphrase derivation on top. */
export const rawKey = (dek: Uint8Array): string => `x'${bytesToHex(dek)}'`;

export function createVault({ driver, dekStore, events, clock }: VaultDeps): Vault {
  const registered = new Map<ModuleName, VaultMigration[]>();
  let opened = false;
  // One piece of work at a time: open, close, migrations and transactions.
  let queue: Promise<unknown> = Promise.resolve();

  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work);
    queue = next.catch(() => undefined);
    return next;
  }

  async function applyPending(module: ModuleName, migrations: VaultMigration[]): Promise<void> {
    const rows = await driver.execute('SELECT version FROM vault_migrations WHERE module = ?', [
      module,
    ]);
    const applied = new Set(rows.map((r) => Number(r.version)));
    for (const m of migrations) {
      if (applied.has(m.version)) continue;
      await driver.execute('BEGIN');
      try {
        await driver.execute(m.up);
        await driver.execute(
          'INSERT INTO vault_migrations (module, version, applied_at) VALUES (?, ?, ?)',
          [module, m.version, clock.now().toISOString()],
        );
        await driver.execute('COMMIT');
      } catch (error) {
        await driver.execute('ROLLBACK');
        throw error;
      }
    }
  }

  async function doOpen(dek: Uint8Array): Promise<void> {
    if (dek.length !== KEY_LENGTH) throw new RangeError(`The DEK must be ${KEY_LENGTH} bytes`);
    if (opened) return;
    await driver.open(rawKey(dek));
    try {
      // A build without SQLCipher answers nothing: stop before any table is written.
      const [info] = await driver.execute('PRAGMA cipher_version');
      if (!String(Object.values(info ?? {})[0] ?? '').trim()) throw new VaultNotEncryptedError();
      // SQLCipher checks the key on the first read: a wrong key fails here.
      await driver.execute('SELECT count(*) FROM sqlite_master');
      await driver.execute(
        `CREATE TABLE IF NOT EXISTS vault_migrations (
           module TEXT NOT NULL,
           version INTEGER NOT NULL,
           applied_at TEXT NOT NULL,
           PRIMARY KEY (module, version)
         )`,
      );
      for (const [module, migrations] of registered) await applyPending(module, migrations);
    } catch (error) {
      await driver.close().catch(() => undefined);
      throw error;
    }
    opened = true;
    events.emit({ type: 'vault.unlocked' });
  }

  async function doClose(): Promise<void> {
    if (!opened) return;
    opened = false;
    await driver.close();
    events.emit({ type: 'vault.locked' });
  }

  // A VaultDb kept by a module keeps working only while the vault is open.
  const run = async (sql: string, params?: unknown[]) => {
    if (!opened) throw new VaultLockedError();
    return driver.execute(sql, params);
  };

  // Statements inside a transaction run directly: the transaction already holds the queue.
  const tx: VaultTx = {
    async query<T>(sql: string, params?: unknown[]) {
      return (await run(sql, params)) as T[];
    },
    async execute(sql: string, params?: unknown[]) {
      await run(sql, params);
    },
  };

  // Statements outside a transaction wait in the queue, so they never land inside another
  // module's open transaction (one connection) and get rolled back with it. Calling db
  // instead of tx inside a transaction callback would wait forever, so modules must use tx.
  const db: VaultDb = {
    query: <T>(sql: string, params?: unknown[]) => enqueue(() => tx.query<T>(sql, params)),
    execute: (sql: string, params?: unknown[]) => enqueue(() => tx.execute(sql, params)),
    transaction<T>(fn: (t: VaultTx) => Promise<T>): Promise<T> {
      return enqueue(async () => {
        if (!opened) throw new VaultLockedError();
        await driver.execute('BEGIN');
        try {
          const result = await fn(tx);
          await driver.execute('COMMIT');
          return result;
        } catch (error) {
          await driver.execute('ROLLBACK');
          throw error;
        }
      });
    },
  };

  return {
    open: (dek) => enqueue(() => doOpen(dek)),
    close: () => enqueue(doClose),
    isOpen: () => opened,
    getVaultDb() {
      if (!opened) throw new VaultLockedError();
      return db;
    },
    registerVaultMigrations(module, migrations) {
      if (registered.has(module)) {
        throw new Error(`Vault migrations of ${module} are already registered`);
      }
      const versions = new Set<number>();
      for (const m of migrations) {
        if (!Number.isInteger(m.version) || m.version < 1) {
          throw new Error(`Migration versions must be positive integers (${module}@${m.version})`);
        }
        if (versions.has(m.version)) {
          throw new Error(`Duplicate migration version ${module}@${m.version}`);
        }
        versions.add(m.version);
        assertTablePrefix(module, m);
      }
      const sorted = [...migrations].sort((a, b) => a.version - b.version);
      registered.set(module, sorted);
      // A module that registers after unlock gets its tables now. A failure is retried and
      // reported by the next open, which applies every pending migration again.
      if (opened) void enqueue(() => applyPending(module, sorted)).catch(() => undefined);
    },
    wipe: () =>
      enqueue(async () => {
        try {
          if (opened) {
            opened = false;
            await driver.close();
          }
          await driver.deleteFile();
        } finally {
          // Even if the file stays, without its key it can never be read again.
          await dekStore.removeAll();
          // The backup PR also clears the backup state here.
          events.emit({ type: 'vault.locked' });
        }
      }),
  };
}
