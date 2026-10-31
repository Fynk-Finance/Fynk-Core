// Public API of the vault module. Other modules import only from this file.
import type { ModuleRoutes } from '@shared/navigation';
import type { GetVaultDb, RegisterVaultMigrations } from '@shared/ports/vault';

import { useSession } from '@modules/identity';

import { watchAppState } from './adapters/appStateLock';
import { lockController } from './adapters/defaultLock';
import { copyText } from './adapters/clipboard';
import { vault } from './adapters/defaultVault';
import { createNewRecoveryCodeScreen } from './ui/NewRecoveryCodeScreen';
import { RECOVERY_CODE_ROUTE, RecoveryCodeRow } from './ui/RecoveryCodeRow';
import { createUnlockSetting } from './ui/UnlockSetting';
import { createVaultFlow } from './ui/VaultFlow';
import { createUseVaultGate } from './ui/useVaultGate';

// identity/index.ts imports this file (wipe) and this file imports identity. The cycle works
// because identity is only called inside functions, hooks and effects, never while loading.
export const routes: ModuleRoutes = {
  module: 'vault',
  // Lock screen and the recovery code of a new account, shown with a fade and no back gesture
  // (flow change).
  flow: createVaultFlow(lockController, { copyText }),
  // Open while there is a session and the vault is not unlocked.
  useGate: createUseVaultGate({
    controller: lockController,
    useSession: () => useSession(),
    watchAppState,
  }),
  screens: [
    {
      // "Generar un código nuevo", pushed from Seguridad with the default transition.
      name: RECOVERY_CODE_ROUTE,
      component: createNewRecoveryCodeScreen({ controller: lockController, copyText }),
      path: 'boveda/recuperacion',
    },
  ],
};

export const registerVaultMigrations: RegisterVaultMigrations = (module, migrations) =>
  vault.registerVaultMigrations(module, migrations);

export const getVaultDb: GetVaultDb = () => vault.getVaultDb();

/**
 * Erases the vault: closes it, deletes the file and both copies of the key.
 * M1 calls it when this device was removed from the account. Safe when nothing was ever created.
 */
export const wipe = async (): Promise<void> => {
  try {
    await vault.wipe();
  } finally {
    lockController.reset();
  }
};

/** M2's "Desbloqueo" card on M1's Seguridad screen: the Face ID or fingerprint switch. */
export const UnlockSetting = createUnlockSetting(lockController);

/** M2's "Código de recuperación" section on M1's Seguridad screen: "Generar un código nuevo". */
export { RecoveryCodeRow };
