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
