// Public API of the recurring module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M9 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'recurring',
  tab: createPlaceholderScreen({
    title: 'Billetera',
    owner: 'M9 · Gastos recurrentes y suscripciones',
    withHeader: true,
  }),
};
