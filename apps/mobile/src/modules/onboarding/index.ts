// Public API of the onboarding module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

// Placeholder routes from M0 (M3 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'onboarding',
  flow: createPlaceholderScreen({ title: 'Configuración', owner: 'M3 · Configuración inicial' }),
  // Not shown until the module implements its gate.
  useGate: () => false,
};
