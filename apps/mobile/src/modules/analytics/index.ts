// Public API of the analytics module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M10 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'analytics',
  screens: [
    {
      name: 'analytics.Spending',
      component: createPlaceholderScreen({
        title: 'Gastos por categoría',
        owner: 'M10 · Análisis y topes',
      }),
      path: 'analisis',
    },
  ],
};
