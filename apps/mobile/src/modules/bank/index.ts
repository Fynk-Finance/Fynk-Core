// Public API of the bank module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M5 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'bank',
  screens: [
    {
      name: 'bank.Connect',
      component: createPlaceholderScreen({
        title: 'Conectar banco',
        owner: 'M5 · Banco y sincronización',
      }),
      path: 'bank/conectar',
    },
  ],
};
