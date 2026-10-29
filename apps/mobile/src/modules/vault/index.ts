// Public API of the vault module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';
import type { GetVaultDb, RegisterVaultMigrations } from '@shared/ports/vault';

import { useSession } from '@modules/identity';

import { watchAppState } from './adapters/appStateLock';
import { lockController } from './adapters/defaultLock';
import { vault } from './adapters/defaultVault';
import { createVaultFlow } from './ui/VaultFlow';
import { createUseVaultGate } from './ui/useVaultGate';

// identity/index.ts imports this file (wipe) and this file imports identity. The cycle works
// because identity is only called inside functions, hooks and effects, never while loading.
export const routes: ModuleRoutes = {
  module: 'vault',
  // Lock screen, shown with a fade and no back gesture (flow change).
  flow: createVaultFlow(lockController),
  // Open while there is a session and the vault is not unlocked.
  useGate: createUseVaultGate({
    controller: lockController,
    useSession: () => useSession(),
    watchAppState,
  }),
  screens: [
    {
      name: 'vault.RecoveryCode',
      component: createPlaceholderScreen({
        title: 'Código de recuperación',
        owner: 'M2 · Bóveda y respaldo',
      }),
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

/** Placeholder: M2's row on M1's Seguridad screen (app unlock setting). Renders nothing yet. */
export function UnlockSetting(): null {
  return null;
}

/** Placeholder: M2's row on M1's Seguridad screen (recovery code). Renders nothing yet. */
export function RecoveryCodeRow(): null {
  return null;
}
