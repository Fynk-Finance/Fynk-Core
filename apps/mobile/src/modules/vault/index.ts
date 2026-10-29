// Public API of the vault module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

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

/**
 * Placeholder until M2 builds the vault: there is nothing to erase yet.
 * M2 replaces it. M1 calls it when this device was removed from the account.
 */
export async function wipe(): Promise<void> {}

/** Placeholder: M2's row on M1's Seguridad screen (app unlock setting). Renders nothing yet. */
export function UnlockSetting(): null {
  return null;
}

/** Placeholder: M2's row on M1's Seguridad screen (recovery code). Renders nothing yet. */
export function RecoveryCodeRow(): null {
  return null;
}
