// Public API of the transactions module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M7 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'transactions',
  screens: [
    {
      name: 'transactions.All',
      component: createPlaceholderScreen({ title: 'Movimientos', owner: 'M7 · Movimientos' }),
      path: 'movimientos',
    },
  ],
};
