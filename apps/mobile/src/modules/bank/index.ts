// Public API of the bank module. Other modules import only from this file.
import { AppState } from 'react-native';

import { api } from '@shared/api';
import type { Clock } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import { onConsentRevoked } from '@modules/consents';
import { notificationsPort } from '@modules/notifications';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { createBankApi } from './adapters/bankApi';
import { createProvidersApi } from './adapters/providersApi';
import { secureRandom, systemBrowser } from './adapters/systemBrowser';
import { bankMigrations } from './adapters/vault/migrations';
import { createVaultLinkStore } from './adapters/vault/vaultLinkStore';
import { linkBank } from './application/linkBank';
import { revokeLinksOfConsent } from './application/linkRevocation';
import { createSyncController } from './application/syncController';
import type { SyncReport } from './application/syncEngine';
import { useSync as useSyncWith } from './application/useSync';
import { useProviders as useProvidersWith } from './application/useProviders';
import type { BankLink } from './domain/link';
import { newNonce } from './domain/pkce';
import { createConnectBankScreen } from './ui/ConnectBankScreen';

export type { BankProvider, ProviderKind } from './domain/provider';
export type { BankLink, LinkStatus } from './domain/link';
export type { SyncReport, LinkSyncResult } from './application/syncEngine';
export type { UseSync } from './application/useSync';
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

// The sync engine is built (application/syncEngine.ts) but gets no writers until M6's
// upsertFromSync and M7's writer for synced movements are on develop. Until then syncNow()
// answers 'unavailable' and asks nothing of any bank, and no trigger is started.
let providerNames: Promise<Map<string, string>> | null = null;
const entityName = async (provider: string) => {
  providerNames ??= providersApi
    .list()
    .then((list) => new Map(list.map((p) => [p.id, p.displayName])));
  try {
    return (await providerNames).get(provider) ?? provider;
  } catch {
    providerNames = null;
    return provider;
  }
};
const sync = createSyncController({
  engine: null,
  links: () => links().getLinks(),
  entityName,
  notify: (n) => notificationsPort.notify(n),
  clock,
});
sync.start({
  onVaultUnlocked: (fn) => appEvents.on('vault.unlocked', fn),
  onAppState: (fn) => {
    const subscription = AppState.addEventListener('change', fn);
    return () => subscription.remove();
  },
});

/** Asks for a sync now (pull to refresh). Waits out the 60 s cooldown per link. */
export const syncNow = (): Promise<SyncReport> => sync.syncNow();

/** Sync state for the screens: status, last update date, refresh(). */
export const useSync = () => useSyncWith(sync);

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
