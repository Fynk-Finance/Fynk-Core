// Public API of the vault module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';
import type { GetVaultDb, RegisterVaultMigrations } from '@shared/ports/vault';

import { vault } from './adapters/defaultVault';

// Placeholder routes from M0 (M2 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'vault',
  flow: createPlaceholderScreen({ title: 'Desbloquear', owner: 'M2 · Bóveda y respaldo' }),
  // Not shown until the module implements its gate.
  useGate: () => false,
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
export const wipe = (): Promise<void> => vault.wipe();

/** Placeholder: M2's row on M1's Seguridad screen (app unlock setting). Renders nothing yet. */
export function UnlockSetting(): null {
  return null;
}

/** Placeholder: M2's row on M1's Seguridad screen (recovery code). Renders nothing yet. */
export function RecoveryCodeRow(): null {
  return null;
}
