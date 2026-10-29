// Public API of the bank module. Other modules import only from this file.
import type { ModuleRoutes } from '@shared/navigation';

import { createProvidersApi } from './adapters/providersApi';
import { useProviders as useProvidersWith } from './application/useProviders';
import { createConnectBankScreen } from './ui/ConnectBankScreen';

export type { BankProvider, ProviderKind } from './domain/provider';

const providersApi = createProvidersApi();

/** Entities the person can connect (`GET /providers`, React Query). */
export const useProviders = () => useProvidersWith(providersApi);

/** Conectar banco: the entity selector with M4's consent cards and authorization. */
export const ConnectBankScreen = createConnectBankScreen({ providers: providersApi });

export const routes: ModuleRoutes = {
  module: 'bank',
  screens: [
    {
      // Pushed with the default transition (inventory row 29).
      name: 'bank.Connect',
      component: ConnectBankScreen,
      path: 'bank/conectar',
    },
  ],
};
