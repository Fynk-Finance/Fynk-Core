// Whether the person's recovery code is saved, for the "Código de recuperación" row of
// onboarding's Listo (M3). The code counts as saved once the server holds the key wrapped with it,
// which happens only after "Ya lo guardé" (confirmRecoveryCode).
import type { RecoveryKeyApi } from './ports';

/**
 * `saved`: the server has the recovery key. `pending`: it has none (the app closed before "Ya lo
 * guardé", or the backup was reset). `unavailable`: no backup in this build, or the server could
 * not be asked; the caller shows no status rather than a guess.
 */
export type RecoveryCodeStatus = 'saved' | 'pending' | 'unavailable';

export interface RecoveryCodeStatusDeps {
  backupEnabled: () => boolean;
  recoveryKey: Pick<RecoveryKeyApi, 'get'>;
}

export function createRecoveryCodeStatus(deps: RecoveryCodeStatusDeps) {
  return async function recoveryCodeStatus(): Promise<RecoveryCodeStatus> {
    if (!deps.backupEnabled()) return 'unavailable';
    try {
      return (await deps.recoveryKey.get()) ? 'saved' : 'pending';
    } catch {
      return 'unavailable';
    }
  };
}
