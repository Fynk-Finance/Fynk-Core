// "No tengo ninguno de los dos" (HU-045, ADR 0002 "Lost phone and lost code"). The server decides:
// it allows the reset only after a password reset with the email code and a new sign in. Nothing
// is created here: after `ok` the lock controller runs the first phone path, which makes a new
// DEK and a new recovery code.
import { isResetError, type BackupResetApi } from './ports';

/**
 * `ok`: the backup is gone and this phone is active. `notAllowed`: the person must reset the
 * password with the email code first. `notActive`: this phone was removed from the account.
 */
export type ResetResult = 'ok' | 'notAllowed' | 'notActive' | 'offline' | 'failed';

export interface ResetBackup {
  reset(): Promise<ResetResult>;
}

export function createResetBackup(deps: { api: BackupResetApi }): ResetBackup {
  return {
    async reset() {
      try {
        await deps.api.reset();
        return 'ok';
      } catch (error) {
        if (isResetError(error, 'notAllowed')) return 'notAllowed';
        if (isResetError(error, 'notActive')) return 'notActive';
        if (isResetError(error, 'offline')) return 'offline';
        return 'failed';
      }
    },
  };
}
