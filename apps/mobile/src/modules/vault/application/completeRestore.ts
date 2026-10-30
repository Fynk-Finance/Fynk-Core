// The steps both restore paths share once the DEK is known (code or approval). The caller opens
// the way to the DEK and zeroes its own copy; nothing here logs, results carry only a kind.
import type { DekStore } from './ports';
import type { RestoreState } from './restoreState';
import type { Vault } from './vault';

/** `partial`: the vault is open but the download did not finish; the mark stays for the next open. */
export type CompleteRestoreResult = 'restored' | 'partial' | 'failed';

export interface CompleteRestoreDeps {
  dekStore: Pick<DekStore, 'write' | 'remove'>;
  vault: Pick<Vault, 'open' | 'close' | 'wipe'>;
  restoreState: RestoreState;
  /** Downloads and imports the whole backup (BackupSync.restoreAll). */
  restoreAll: () => Promise<unknown>;
}

/** The server already activated this phone when this runs. */
export type CompleteRestore = (dek: Uint8Array) => Promise<CompleteRestoreResult>;

export function createCompleteRestore(deps: CompleteRestoreDeps): CompleteRestore {
  const { vault, restoreState } = deps;

  // Back to a phone with no key. The phone is already active, so the person restores with the code.
  async function undo(): Promise<void> {
    try {
      await vault.close();
      await deps.dekStore.remove();
    } catch {
      // The next try wipes the file again.
    }
  }

  return async function completeRestore(dek) {
    // A left-over file cannot be read with this key, so it goes first.
    try {
      await vault.wipe();
      await deps.dekStore.write(dek);
      await vault.open(dek);
      await restoreState.mark();
    } catch {
      await undo();
      return 'failed';
    }
    try {
      await deps.restoreAll();
      await restoreState.clear();
      return 'restored';
    } catch {
      // The vault stays open with the mark on; the next open retries.
      return 'partial';
    }
  };
}
