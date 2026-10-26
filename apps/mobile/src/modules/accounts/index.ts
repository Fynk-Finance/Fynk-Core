// Public API of the accounts module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M6 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'accounts',
  tab: createPlaceholderScreen({ title: 'Dashboard', owner: 'M6 · Cuentas', withHeader: true }),
};
