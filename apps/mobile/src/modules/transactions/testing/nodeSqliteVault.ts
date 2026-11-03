// VaultDb for M7 tests on Node's own SQLite (node:sqlite). The shared test vault (sql.js) has no
// FTS5, and the phone's SQLCipher has only FTS5, so the search index can only be tested here.
// Same contract as shared/testing/inMemoryVaultDb.ts. Test-only: never import it from app code.
import type { ModuleName } from '@shared/domain/types';
import type { VaultDb, VaultMigration, VaultTx } from '@shared/ports';

type SqlParam = null | number | bigint | string | Uint8Array;

interface StatementSync {
  all(...params: SqlParam[]): Record<string, unknown>[];
  run(...params: SqlParam[]): unknown;
}
interface DatabaseSync {
  exec(sql: string): void;
  prepare(sql: string): StatementSync;
  close(): void;
}
interface NodeSqlite {
  DatabaseSync: new (path: string) => DatabaseSync;
}

export interface NodeSqliteVault {
  db: VaultDb;
  /** Same contract as M2's registerVaultMigrations. */
  registerMigrations(module: ModuleName, migrations: VaultMigration[]): void;
  /** Applies every pending migration of every registered module, in version order. */
  migrate(): Promise<void>;
  close(): void;
}

// process.getBuiltinModule skips Jest's module registry, which does not know node:sqlite.
function loadSqlite(): NodeSqlite {
  const getBuiltin = (process as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
  const sqlite = getBuiltin?.('node:sqlite') as NodeSqlite | undefined;
  if (!sqlite) throw new Error('node:sqlite needs Node 22.5 or later');
  return sqlite;
}

function toParam(value: unknown): SqlParam {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'string' ||
    value instanceof Uint8Array
  ) {
    return value;
  }
  throw new TypeError(`Unsupported SQL parameter of type ${typeof value}`);
}

const CREATE_TABLE = /create\s+(?:virtual\s+)?table\s+(?:if\s+not\s+exists\s+)?["`[]?(\w+)/gi;

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

export function createNodeSqliteVault(): NodeSqliteVault {
  const { DatabaseSync } = loadSqlite();
  const database = new DatabaseSync(':memory:');
  database.exec(
    'CREATE TABLE vault_migrations (module TEXT NOT NULL, version INTEGER NOT NULL, PRIMARY KEY (module, version))',
  );

  const run = <T>(sql: string, params: unknown[] = []): T[] => {
    const statement = database.prepare(sql);
    const values = params.map(toParam);
    // Only statements that return rows can use all(); writes go through run().
    return /^\s*(select|with|pragma)\b/i.test(sql) || /\breturning\b/i.test(sql)
      ? (statement.all(...values) as T[])
      : (statement.run(...values), []);
  };

  const registered = new Map<ModuleName, VaultMigration[]>();
  let queue: Promise<unknown> = Promise.resolve();

  const tx: VaultTx = {
    async query<T>(sql: string, params?: unknown[]) {
      return run<T>(sql, params);
    },
    async execute(sql: string, params?: unknown[]) {
      if (params === undefined || params.length === 0) database.exec(sql);
      else run(sql, params);
    },
  };

  const db: VaultDb = {
    ...tx,
    transaction<T>(fn: (t: VaultTx) => Promise<T>): Promise<T> {
      const next = queue.then(async () => {
        database.exec('BEGIN');
        try {
          const result = await fn(tx);
          database.exec('COMMIT');
          return result;
        } catch (error) {
          database.exec('ROLLBACK');
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
      for (const m of migrations) assertTablePrefix(module, m);
      registered.set(
        module,
        [...migrations].sort((a, b) => a.version - b.version),
      );
    },
    async migrate() {
      for (const [module, migrations] of registered) {
        const applied = new Set(
          run<{ version: number }>('SELECT version FROM vault_migrations WHERE module = ?', [
            module,
          ]).map((r) => Number(r.version)),
        );
        for (const m of migrations) {
          if (applied.has(m.version)) continue;
          await db.transaction(async () => {
            database.exec(m.up);
            run('INSERT INTO vault_migrations (module, version) VALUES (?, ?)', [
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
