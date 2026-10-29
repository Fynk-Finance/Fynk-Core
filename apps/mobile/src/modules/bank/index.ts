// Public API of the bank module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

import { createProvidersApi } from './adapters/providersApi';
import { useProviders as useProvidersWith } from './application/useProviders';

export type { BankProvider, ProviderKind } from './domain/provider';

const providersApi = createProvidersApi();

/** Entities the person can connect (`GET /providers`, React Query). */
export const useProviders = () => useProvidersWith(providersApi);

// Placeholder routes from M0 (M5 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'bank',
  screens: [
    {
      name: 'bank.Connect',
      component: createPlaceholderScreen({
        title: 'Conectar banco',
        owner: 'M5 · Banco y sincronización',
      }),
      path: 'bank/conectar',
    },
  ],
};
