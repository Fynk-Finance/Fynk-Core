// Public API of the compliance module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M13 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'compliance',
  screens: [
    {
      name: 'compliance.Privacy',
      component: createPlaceholderScreen({
        title: 'Privacidad y datos',
        owner: 'M13 · Cumplimiento y auditoría',
      }),
      path: 'privacidad',
    },
  ],
};
