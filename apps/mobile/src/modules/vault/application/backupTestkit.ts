// Fakes shared by the backup tests. Test-only: never import this file from app code.
import { createAppEvents } from '@shared/events/appEvents';
import type { BackupCollection, BackupRecord } from '@shared/ports/backup';
import { VaultLockedError, type VaultDb } from '@shared/ports/vault';
import { createInMemoryVault } from '@shared/testing';

import { vaultMigrations } from '../adapters/vault/migrations';
import { createBackupRegistry } from './backupRegistry';

/** A real SQLite vault with the vault module's table, that can be locked and unlocked. */
export async function createLockableVault() {
  const vault = await createInMemoryVault();
  vault.registerMigrations('vault', vaultMigrations);
  await vault.migrate();
  const events = createAppEvents();
  let open = true;
  const getVaultDb = (): VaultDb => {
    if (!open) throw new VaultLockedError();
    return vault.db;
  };
  const registry = createBackupRegistry({ getVaultDb, events });
  return {
    events,
    registry,
    /** The database, even while locked, to look at the table from the test. */
    db: vault.db,
    lock() {
      open = false;
      events.emit({ type: 'vault.locked' });
    },
    unlock() {
      open = true;
      events.emit({ type: 'vault.unlocked' });
    },
    dirty: () =>
      vault.db.query<{ collection: string; record_id: string; seq: number }>(
        'SELECT collection, record_id, seq FROM vault_backup_dirty ORDER BY collection, record_id',
      ),
  };
}

export interface Goal {
  name: string;
}

/** A collection backed by a map. importAll keeps the higher version, like a real module should. */
export function createFakeCollection(
  collection: string,
  module: BackupCollection<Goal>['module'],
  initial: BackupRecord<Goal>[] = [],
) {
  const store = new Map(initial.map((r) => [r.id, r]));
  const imports: BackupRecord<unknown>[][] = [];
  const c: BackupCollection<Goal> = {
    module,
    collection,
    exportAll: async () => [...store.values()],
    importAll: async (records) => {
      imports.push(records);
      for (const r of records) {
        const known = store.get(r.id);
        if (!known || r.version > known.version) store.set(r.id, r);
      }
    },
  };
  return { collection: c, store, imports };
}

export const goal = (id: string, version = 1, name = `Meta ${id}`): BackupRecord<Goal> => ({
  id,
  version,
  deleted: false,
  data: { name },
});
