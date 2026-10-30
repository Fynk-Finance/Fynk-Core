// The "restore pending" mark: set when a restore from the backup starts on a new phone, cleared
// when it ends. While it is set, the next open of the vault restores again. It lives in the vault
// itself (table vault_state), so it needs the vault open.
import type { GetVaultDb } from '@shared/ports/vault';

const KEY = 'restore_pending';

export interface RestoreState {
  mark(): Promise<void>;
  clear(): Promise<void>;
  isPending(): Promise<boolean>;
}

export function createRestoreState(getVaultDb: GetVaultDb): RestoreState {
  return {
    mark: () =>
      getVaultDb().execute('INSERT OR REPLACE INTO vault_state (key, value) VALUES (?, ?)', [
        KEY,
        '1',
      ]),
    clear: () => getVaultDb().execute('DELETE FROM vault_state WHERE key = ?', [KEY]),
    async isPending() {
      const rows = await getVaultDb().query('SELECT value FROM vault_state WHERE key = ?', [KEY]);
      return rows.length > 0;
    },
  };
}
