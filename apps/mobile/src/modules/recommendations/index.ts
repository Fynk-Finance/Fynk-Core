// Public API of the recommendations module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M11 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'recommendations',
  tab: createPlaceholderScreen({
    title: 'Recomendaciones',
    owner: 'M11 · Recomendaciones',
    withHeader: true,
  }),
};
