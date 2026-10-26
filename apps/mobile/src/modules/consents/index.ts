// Public API of the consents module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M4 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'consents',
  screens: [
    {
      name: 'consents.List',
      component: createPlaceholderScreen({
        title: 'Consentimientos',
        owner: 'M4 · Consentimientos',
      }),
      path: 'consentimientos',
    },
  ],
};
