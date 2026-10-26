// Public API of the investment module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M15 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'investment',
  tab: createPlaceholderScreen({ title: 'Inversión', owner: 'M15 · Inversión', withHeader: true }),
};
