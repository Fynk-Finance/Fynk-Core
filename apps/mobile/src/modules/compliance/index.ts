// Public API of the compliance module. Other modules import only from this file.
import type { ModuleRoutes } from '@shared/navigation';

import { PrivacyScreen } from './ui/PrivacyScreen';
import { complianceStrings } from './ui/strings.es-CO';

export { PrivacyScreen } from './ui/PrivacyScreen';

export const PRIVACY_ROUTE = 'compliance.Privacy' as const;

export const privacyMiCuentaRow = {
  id: 'privacy',
  ...complianceStrings.miCuentaRow,
  icon: 'eye',
  target: { kind: 'navigate', route: PRIVACY_ROUTE },
} as const;

export const routes: ModuleRoutes = {
  module: 'compliance',
  screens: [
    {
      name: PRIVACY_ROUTE,
      component: PrivacyScreen,
      path: 'privacidad',
    },
  ],
};
