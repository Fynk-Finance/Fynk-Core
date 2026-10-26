// Public API of the identity module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M1 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'identity',
  flow: createPlaceholderScreen({ title: 'Inicio', owner: 'M1 · Identidad' }),
  // Not shown until the module implements its gate.
  useGate: () => false,
  screens: [
    {
      name: 'identity.Account',
      component: createPlaceholderScreen({ title: 'Mi cuenta', owner: 'M1 · Identidad' }),
      path: 'cuenta',
    },
  ],
};
