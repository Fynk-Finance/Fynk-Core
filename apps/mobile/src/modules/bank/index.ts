// Public API of the bank module. Other modules import only from this file.
import { AppState } from 'react-native';

import { api } from '@shared/api';
import type { Clock } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import { markLinkRevoked, upsertFromSync as upsertAccounts } from '@modules/accounts';
import { onConsentRevoked } from '@modules/consents';
import { notificationsPort } from '@modules/notifications';
import { upsertFromSync as upsertTransactions } from '@modules/transactions';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { createBankApi } from './adapters/bankApi';
import { createProvidersApi } from './adapters/providersApi';
import { secureRandom, systemBrowser } from './adapters/systemBrowser';
import { bankMigrations } from './adapters/vault/migrations';
import { createVaultLinkStore } from './adapters/vault/vaultLinkStore';
import { linkBank } from './application/linkBank';
import { revokeLinksOfConsent } from './application/linkRevocation';
import { syncNewLink } from './application/firstSync';
import { createSyncController } from './application/syncController';
import { createSyncEngine, type SyncReport } from './application/syncEngine';
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

// HU-008: a revoked consent ends its links on the phone at once, deletes their tokens, and
// M6 marks their accounts revoked ("Reconecta <Entidad>").
onConsentRevoked(async (event) => {
  const revoked = await revokeLinksOfConsent({ store: links, clock }, event);
  for (const linkId of revoked) await markLinkRevoked(linkId);
});

/** Every bank link, active or revoked, oldest first. Never includes tokens. */
export const getLinks = (): Promise<BankLink[]> => links().getLinks();

const providersApi = createProvidersApi();
const bankApi = createBankApi(api, () => newNonce(secureRandom));

// The sync writes accounts through M6 and movements through M7 (they are the only places that
// store them). M6 and M7 are used only inside functions, never while this file loads: M7
// imports this module too, and an import cycle must not see an undefined value.
const engine = createSyncEngine({
  api: bankApi,
  store: links,
  accounts: () => ({ upsertFromSync: upsertAccounts, markLinkRevoked }),
  transactions: () => ({ upsertFromSync: upsertTransactions }),
  events: appEvents,
  clock,
});
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
  engine,
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
  link: async (input) => {
    const outcome = await linkBank(
      { api: bankApi, browser: systemBrowser, store: links, random: secureRandom, clock },
      input,
    );
    // Link flow step 5: the first sync (12 months) starts at once. Its result reaches the
    // screens through useSync and M12's notice, so the link result never waits for it.
    if (outcome.kind === 'linked') void syncNewLink(syncNow, outcome.linkId).catch(() => undefined);
    return outcome;
  },
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
