// Vault port (00-shared-contracts.md, section 3.1). Implemented by M2 (SQLCipher vault).
// Tests use createInMemoryVault() from @shared/testing.
//
// Rules:
// * Each module owns its tables, always prefixed with the module name (`savings_goals`).
// * Each module keeps its migrations in modules/<module>/adapters/vault/migrations.ts.
//   The runner tracks vault_migrations(module, version), so versions never collide.
// * A module reads another module's data only through that module's index.ts, never with SQL.
import type { ModuleName } from '../domain/types';

export interface VaultTx {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
}

export interface VaultDb extends VaultTx {
  transaction<T>(fn: (tx: VaultTx) => Promise<T>): Promise<T>;
}

export interface VaultMigration {
  version: number;
  up: string;
}

/** Signature of M2's registerVaultMigrations, exported from @modules/vault. */
export type RegisterVaultMigrations = (module: ModuleName, migrations: VaultMigration[]) => void;

/** Signature of M2's getVaultDb, exported from @modules/vault. Throws VaultLockedError while locked. */
export type GetVaultDb = () => VaultDb;

export class VaultLockedError extends Error {
  constructor(message = 'The vault is locked') {
    super(message);
    this.name = 'VaultLockedError';
  }
}
