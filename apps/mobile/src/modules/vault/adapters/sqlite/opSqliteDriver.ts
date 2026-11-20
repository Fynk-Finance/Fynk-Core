// VaultDriver over op-sqlite built with SQLCipher (see "op-sqlite" in package.json).
//
// How the key is applied: op-sqlite passes `encryptionKey` as the raw bytes of the string to
// sqlite3_key_v2 (OPBridge.cpp), not through `PRAGMA key`. SQLCipher reads a key written as
// x'<64 hex>' as the 32 byte key itself and skips its passphrase derivation, so the DEK is
// used as is. The library is loaded on first use, so importing the module touches no native code.
import type { DB } from '@op-engineering/op-sqlite';

import type { Row, VaultDriver } from '../../application/ports';

// The phone used to hold a single vault under this name; only the one-time legacy erase uses it.
export const LEGACY_VAULT_DB_NAME = 'fynk-vault.db';

/** One file per account: `fynk-vault-<slot>.db`. */
export const vaultDbName = (slot: string) => `fynk-vault-${slot}.db`;

type OpSqlite = typeof import('@op-engineering/op-sqlite');
type Load = () => Promise<OpSqlite>;
const defaultLoad: Load = () => import('@op-engineering/op-sqlite');

/** Deletes the legacy single vault file. A missing file counts as deleted. */
export async function deleteLegacyVaultFile(load: Load = defaultLoad): Promise<void> {
  try {
    const { open } = await load();
    open({ name: LEGACY_VAULT_DB_NAME, failOnCreate: true }).delete();
  } catch {
    // No file to delete.
  }
}

/**
 * `slot` is read on every call, so the file follows the signed in account. `deleteFile` uses
 * `removalSlot`, so a wipe after sign out still deletes the account's file.
 */
export function createOpSqliteDriver(
  slot: () => string | null,
  load: Load = defaultLoad,
  removalSlot: () => string | null = slot,
): VaultDriver {
  let db: DB | null = null;

  const opened = (): DB => {
    if (!db) throw new Error('The vault database is not open');
    return db;
  };

  return {
    async open(key) {
      const current = slot();
      if (current === null) throw new Error('no signed in account');
      const { open } = await load();
      db = open({ name: vaultDbName(current), encryptionKey: key });
      await db.execute('PRAGMA foreign_keys = ON');
    },
    async execute(sql, params) {
      const result = await opened().execute(sql, params as never);
      return (result.rows ?? []) as Row[];
    },
    async close() {
      const current = db;
      db = null;
      if (current) await current.closeAsync();
    },
    async deleteFile() {
      const current = db;
      db = null;
      const name = removalSlot();
      try {
        if (current) {
          current.delete();
          return;
        }
        // Not open: open a handle only to delete. It never creates the file and needs no key,
        // because SQLCipher reads the key lazily on the first query.
        if (name === null) return;
        const { open } = await load();
        open({ name: vaultDbName(name), failOnCreate: true }).delete();
      } catch {
        // No file to delete.
      }
    },
  };
}
