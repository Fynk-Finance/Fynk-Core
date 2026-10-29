// VaultDriver over op-sqlite built with SQLCipher (see "op-sqlite" in package.json).
//
// How the key is applied: op-sqlite passes `encryptionKey` as the raw bytes of the string to
// sqlite3_key_v2 (OPBridge.cpp), not through `PRAGMA key`. SQLCipher reads a key written as
// x'<64 hex>' as the 32 byte key itself and skips its passphrase derivation, so the DEK is
// used as is. The library is loaded on first use, so importing the module touches no native code.
import type { DB } from '@op-engineering/op-sqlite';

import type { Row, VaultDriver } from '../../application/ports';

export const VAULT_DB_NAME = 'fynk-vault.db';

type OpSqlite = typeof import('@op-engineering/op-sqlite');

export function createOpSqliteDriver(
  load: () => Promise<OpSqlite> = () => import('@op-engineering/op-sqlite'),
): VaultDriver {
  let db: DB | null = null;

  const opened = (): DB => {
    if (!db) throw new Error('The vault database is not open');
    return db;
  };

  return {
    async open(key) {
      const { open } = await load();
      db = open({ name: VAULT_DB_NAME, encryptionKey: key });
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
      try {
        if (current) {
          current.delete();
          return;
        }
        // Not open: open a handle only to delete. It never creates the file and needs no key,
        // because SQLCipher reads the key lazily on the first query.
        const { open } = await load();
        open({ name: VAULT_DB_NAME, failOnCreate: true }).delete();
      } catch {
        // No file to delete.
      }
    },
  };
}
