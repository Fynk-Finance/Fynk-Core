// In-memory VaultDb for tests: a real SQLite database through sql.js (WebAssembly), so module
// SQL and migrations run as they will on the phone, without SQLCipher or native code.
// Test-only: never import this file from app code.
import initSqlJs, { type Database, type SqlValue } from 'sql.js';

import type { ModuleName } from '../domain/types';
import type { VaultDb, VaultMigration, VaultTx } from '../ports/vault';

export interface InMemoryVault {
  db: VaultDb;
  /** Same contract as M2's registerVaultMigrations. */
  registerMigrations(module: ModuleName, migrations: VaultMigration[]): void;
  /** Applies every pending migration of every registered module, in version order. */
  migrate(): Promise<void>;
  close(): void;
}

let sqlJs: ReturnType<typeof initSqlJs> | undefined;

function toSqlValue(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string' || value instanceof Uint8Array) {
    return value;
  }
  throw new TypeError(`Unsupported SQL parameter of type ${typeof value}`);
}

function run<T>(database: Database, sql: string, params: unknown[] = []): T[] {
  const statement = database.prepare(sql);
  try {
    statement.bind(params.map(toSqlValue));
    const rows: T[] = [];
    while (statement.step()) rows.push(statement.getAsObject() as T);
    return rows;
  } finally {
    statement.free();
  }
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

export async function createInMemoryVault(): Promise<InMemoryVault> {
  sqlJs ??= initSqlJs();
  const SQL = await sqlJs;
  const database = new SQL.Database();
  database.run('PRAGMA foreign_keys = ON');
  database.run(
    `CREATE TABLE vault_migrations (
       module TEXT NOT NULL,
       version INTEGER NOT NULL,
       PRIMARY KEY (module, version)
     )`,
  );

  const registered = new Map<ModuleName, VaultMigration[]>();
  // One transaction at a time: callers await async work inside it.
  let queue: Promise<unknown> = Promise.resolve();

  const tx: VaultTx = {
    async query<T>(sql: string, params?: unknown[]) {
      return run<T>(database, sql, params);
    },
    async execute(sql: string, params?: unknown[]) {
      run(database, sql, params);
    },
  };

  const db: VaultDb = {
    ...tx,
    transaction<T>(fn: (t: VaultTx) => Promise<T>): Promise<T> {
      const next = queue.then(async () => {
        database.run('BEGIN');
        try {
          const result = await fn(tx);
          database.run('COMMIT');
          return result;
        } catch (error) {
          database.run('ROLLBACK');
          throw error;
        }
      });
      queue = next.catch(() => undefined);
      return next;
    },
  };

  return {
    db,
    registerMigrations(module, migrations) {
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
      registered.set(
        module,
        [...migrations].sort((a, b) => a.version - b.version),
      );
    },
    async migrate() {
      for (const [module, migrations] of registered) {
        const applied = new Set(
          run<{ version: number }>(
            database,
            'SELECT version FROM vault_migrations WHERE module = ?',
            [module],
          ).map((r) => r.version),
        );
        for (const m of migrations) {
          if (applied.has(m.version)) continue;
          await db.transaction(async () => {
            database.exec(m.up);
            run(database, 'INSERT INTO vault_migrations (module, version) VALUES (?, ?)', [
              module,
              m.version,
            ]);
          });
        }
      }
    },
    close() {
      database.close();
    },
  };
}
