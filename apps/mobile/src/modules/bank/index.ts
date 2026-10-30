// Public API of the bank module. Other modules import only from this file.
import { api } from '@shared/api';
import type { Clock } from '@shared/domain/types';
import type { ModuleRoutes } from '@shared/navigation';

import { onConsentRevoked } from '@modules/consents';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { createBankApi } from './adapters/bankApi';
import { createProvidersApi } from './adapters/providersApi';
import { secureRandom, systemBrowser } from './adapters/systemBrowser';
import { bankMigrations } from './adapters/vault/migrations';
import { createVaultLinkStore } from './adapters/vault/vaultLinkStore';
import { linkBank } from './application/linkBank';
import { revokeLinksOfConsent } from './application/linkRevocation';
import { useProviders as useProvidersWith } from './application/useProviders';
import type { BankLink } from './domain/link';
import { newNonce } from './domain/pkce';
import { createConnectBankScreen } from './ui/ConnectBankScreen';

export type { BankProvider, ProviderKind } from './domain/provider';
export type { BankLink, LinkStatus } from './domain/link';
export { BankLinkList, type BankLinkListItem } from './ui/BankLinkList';
/** "Agregar otra cuenta": opens Conectar banco. For onboarding step 3 (M3) and Billetera (M6). */
export { CONNECT_BANK_ROUTE, ConnectBankButton } from './ui/ConnectBankButton';

registerVaultMigrations('bank', bankMigrations);

const clock: Clock = { now: () => new Date() };
// Read on every call: the vault may be locked when the module loads.
const links = () => createVaultLinkStore(getVaultDb());

// HU-008: a revoked consent ends its links on the phone at once and deletes their tokens.
onConsentRevoked(async (event) => {
  await revokeLinksOfConsent({ store: links, clock }, event);
});

/** Every bank link, active or revoked, oldest first. Never includes tokens. */
export const getLinks = (): Promise<BankLink[]> => links().getLinks();

const providersApi = createProvidersApi();
const bankApi = createBankApi(api, () => newNonce(secureRandom));

/** Entities the person can connect (`GET /providers`, React Query). */
export const useProviders = () => useProvidersWith(providersApi);

/** Conectar banco: the entity selector with M4's consent cards and authorization. */
export const ConnectBankScreen = createConnectBankScreen({
  providers: providersApi,
  link: (input) =>
    linkBank(
      { api: bankApi, browser: systemBrowser, store: links, random: secureRandom, clock },
      input,
    ),
});

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
