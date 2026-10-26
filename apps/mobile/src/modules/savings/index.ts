// Public API of the savings module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M8 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'savings',
  screens: [
    {
      name: 'savings.Goals',
      component: createPlaceholderScreen({
        title: 'Planes de ahorro',
        owner: 'M8 · Metas de ahorro',
      }),
      path: 'metas',
    },
  ],
};
