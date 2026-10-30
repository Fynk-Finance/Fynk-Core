// Restore on a new phone with the recovery code (HU-045, ADR 0002 "A new phone with the code").
// A wrong code is found on the phone: the DEK does not open, so the server hears nothing. Only a
// code that opens the DEK sends the device proof. Nothing is written or opened before the server
// activates this phone, and nothing here logs: results carry only a kind.
import { VaultCryptoError, deriveDeviceProof } from '../domain/crypto';
import { parseRecoveryCode } from '../domain/recoveryCode';
import { createCompleteRestore } from './completeRestore';
import { unwrapDek } from '../domain/recoveryKey';
import {
  isRecoveryError,
  type DekStore,
  type RecoveryKdf,
  type RecoveryKeyApi,
  type StoredRecoveryKey,
} from './ports';
import type { RestoreState } from './restoreState';
import type { Vault } from './vault';

/**
 * `restored`: all records imported. `partial`: the vault is open but the download did not
 * finish (offline); the mark stays and the next open tries again.
 */
export type RestoreResult =
  | 'restored'
  | 'partial'
  | 'invalid'
  | 'wrongCode'
  | 'tooMany'
  | 'noBackup'
  | 'removed'
  | 'offline'
  | 'failed';

export type RestoreFailure = Exclude<RestoreResult, 'restored' | 'partial'>;

export interface RestoreWithCodeDeps {
  recoveryKey: Pick<RecoveryKeyApi, 'get' | 'activate'>;
  kdf: RecoveryKdf;
  dekStore: Pick<DekStore, 'write' | 'remove'>;
  vault: Pick<Vault, 'open' | 'close' | 'wipe'>;
  restoreState: RestoreState;
  /** Downloads and imports the whole backup (BackupSync.restoreAll). */
  restoreAll: () => Promise<unknown>;
}

export interface RestoreWithCode {
  /** `typed` is what the person wrote: groups, lowercase and I/L/O slips are accepted. */
  restore(typed: string): Promise<RestoreResult>;
  /** After an open: finishes a restore that was cut short. Never throws; the mark stays on failure. */
  resumePending(): Promise<void>;
}

/** What a failed call to the recovery key API means for the person. */
function apiFailure(error: unknown): RestoreFailure {
  if (!isRecoveryError(error)) return 'failed';
  switch (error.kind) {
    case 'mismatch':
      return 'wrongCode';
    case 'noKey':
      return 'noBackup';
    case 'tooMany':
    case 'removed':
    case 'offline':
      return error.kind;
    default:
      return 'failed';
  }
}

export function createRestoreWithCode(deps: RestoreWithCodeDeps): RestoreWithCode {
  const { recoveryKey, restoreState } = deps;
  // If it fails, the server already activated this phone, so the next try activates again (204).
  const completeRestore = createCompleteRestore(deps);

  return {
    async restore(typed) {
      const code = parseRecoveryCode(typed);
      if (!code) return 'invalid';

      let rk: Uint8Array | null = null;
      let dek: Uint8Array | null = null;
      let proof: Uint8Array | null = null;
      try {
        let stored: StoredRecoveryKey | null;
        try {
          stored = await recoveryKey.get();
        } catch (error) {
          return apiFailure(error);
        }
        if (!stored) return 'noBackup';

        try {
          rk = await deps.kdf(code, stored.salt);
          dek = unwrapDek(rk, stored.nonce, stored.wrappedDek);
        } catch (error) {
          return error instanceof VaultCryptoError ? 'wrongCode' : 'failed';
        }

        try {
          proof = deriveDeviceProof(dek);
          await recoveryKey.activate(proof);
        } catch (error) {
          return apiFailure(error);
        }

        // Active now: the shared steps write the key, open the vault and download.
        return await completeRestore(dek);
      } finally {
        rk?.fill(0);
        proof?.fill(0);
        dek?.fill(0);
      }
    },
    async resumePending() {
      try {
        if (!(await restoreState.isPending())) return;
        await deps.restoreAll();
        await restoreState.clear();
      } catch {
        // Offline or locked again: the mark stays and the next open tries again.
      }
    },
  };
}
