// Public API of the accounts module. Other modules import only from this file.
// M5 is the only writer (upsertFromSync, markLinkRevoked); everyone else reads.
import type { Account, Clock, Id, IsoDate, MoneyMinor } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { accountsMigrations } from './adapters/vault/migrations';
import { createVaultAccountsStore } from './adapters/vault/vaultAccountsStore';
import { createAccountsService, type AccountsOverview } from './application/accountsService';
import type { BalancePoint } from './application/ports';
import { ACCOUNTS_QUERY_KEY, createUseAccounts } from './application/useAccounts';
import type { ConnectedAccountsSummary } from './domain/netWorth';

export type { AccountsOverview, BalancePoint, ConnectedAccountsSummary };
export { ACCOUNTS_QUERY_KEY };
export { maskedNumber } from './domain/masking';
export { InvalidSyncedAccountError } from './domain/syncedAccounts';

registerVaultMigrations('accounts', accountsMigrations);

const clock: Clock = { now: () => new Date() };

const service = createAccountsService({
  store: () => createVaultAccountsStore(getVaultDb()),
  clock,
});

// Derived values are recomputed after a sync and whenever the vault opens or closes.
appEvents.on('sync.completed', service.notifyChanged);
appEvents.on('vault.unlocked', service.notifyChanged);
appEvents.on('vault.locked', service.notifyChanged);

// ---- Write API, for M5 only ----

/**
 * Saves the accounts of a sync: one row per (provider, providerAccountId), only the last 4
 * digits, and today's balance of each one. Throws InvalidSyncedAccountError and writes nothing
 * when an account is malformed. M5 calls it before emitting sync.completed.
 */
export const upsertFromSync = (accounts: Account[]): Promise<void> =>
  service.upsertFromSync(accounts);

/** Marks the accounts of a revoked bank link: they leave the lists, the total and the count. */
export const markLinkRevoked = (linkId: Id): Promise<void> => service.markLinkRevoked(linkId);

// ---- Read API ----

/** Active accounts with the balance total and the connected count, cached under ['accounts']. */
export const useAccounts = createUseAccounts(service);

/** Active accounts: bank accounts, wallets, cards, CDTs and cash. */
export const getAccounts = (): Promise<Account[]> => service.getAccounts();

/** Balance total: accounts, wallets and cash, minus card debt. CDTs are not counted. */
export const getBalanceTotal = (): Promise<MoneyMinor> => service.getBalanceTotal();

/** Count of connected accounts and the balance total (M3, step Cuentas). */
export const getConnectedAccountsSummary = (): Promise<ConnectedAccountsSummary> =>
  service.getConnectedAccountsSummary();

/** The user's own CDTs (M15). */
export const getCdtAccounts = (): Promise<Account[]> => service.getCdtAccounts();

/** One balance per account per day from `from` on, oldest first (M15 chart). */
export const getBalanceHistory = (accountIds: Id[], from: IsoDate): Promise<BalancePoint[]> =>
  service.getBalanceHistory(accountIds, from);

// Placeholder routes from M0 (the Dashboard comes with feature/dashboard-balance-and-account-detail).
export const routes: ModuleRoutes = {
  module: 'accounts',
  tab: createPlaceholderScreen({ title: 'Dashboard', owner: 'M6 · Cuentas', withHeader: true }),
};
