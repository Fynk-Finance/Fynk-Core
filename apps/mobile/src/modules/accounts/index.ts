// Public API of the accounts module. Other modules import only from this file.
// M5 is the only writer (upsertFromSync, markLinkRevoked); everyone else reads.
import { randomUUID } from 'expo-crypto';

import type { Account, Clock, Id, IsoDate, MoneyMinor } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';
import type { MarkDirty } from '@shared/ports';

import { NOTIFICATIONS_ROUTE, useUnreadCount } from '@modules/notifications';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { accountsMigrations } from './adapters/vault/migrations';
import { createVaultAccountsStore } from './adapters/vault/vaultAccountsStore';
import { createVaultCashStore } from './adapters/vault/vaultCashStore';
import { createAccountsService, type AccountsOverview } from './application/accountsService';
import { createCashService } from './application/cashService';
import type { BalancePoint, Cash } from './application/ports';
import { ACCOUNTS_QUERY_KEY, createUseAccounts } from './application/useAccounts';
import { monthSummary } from './domain/dashboard';
import type { ConnectedAccountsSummary } from './domain/netWorth';
import { createDashboardScreen } from './ui/DashboardScreen';

export type { AccountsOverview, BalancePoint, Cash, ConnectedAccountsSummary };
export type { CashInputProps } from './ui/CashInput';
export { ACCOUNTS_QUERY_KEY };
export { maskedNumber } from './domain/masking';
export { InvalidCashAmountError } from './domain/cash';
export { InvalidSyncedAccountError } from './domain/syncedAccounts';
export { CashInput } from './ui/CashInput';

registerVaultMigrations('accounts', accountsMigrations);

const clock: Clock = { now: () => new Date() };

const service = createAccountsService({
  store: () => createVaultAccountsStore(getVaultDb()),
  clock,
});

// TODO(M2) SCRUM-62 take registerBackupCollection and markDirty from @modules/vault once M2
// exports them, and register cash.backupCollection there. Until then cash is only in the vault.
const markDirty: MarkDirty = () => undefined;

const cash = createCashService({
  store: () => createVaultCashStore(getVaultDb()),
  clock,
  newId: randomUUID,
  markDirty,
  onChanged: service.notifyChanged,
});

/** The accounts.cash collection, for M2's encrypted backup. */
export const cashBackupCollection = cash.backupCollection;

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

// ---- Cash (HU-054) ----

/** The registered cash, or null before the person registers any (M3 prefills CashInput). */
export const getCash = (): Promise<Cash | null> => cash.getCash();

/** Registers or updates cash. Throws InvalidCashAmountError below zero or with decimals. */
export const setCash = (amountMinor: MoneyMinor): Promise<void> => cash.setCash(amountMinor);

// TODO(M10) take Ingresos and Gastos from M10's useMonthSummary(). Until then the temporary
// monthSummary runs on this month's movements, and M7 has none to give yet (TODO(M7)).
const useMonthSummary = () => monthSummary([], clock.now());

export const routes: ModuleRoutes = {
  module: 'accounts',
  // The Dashboard tab (tabOwners in src/app/registry.ts).
  tab: createDashboardScreen({
    useAccounts,
    useMonthSummary,
    useUnreadCount,
    // TODO(M3) the name typed in onboarding, once M3 exports it.
    useDisplayName: () => null,
    accountRoute: 'identity.Account',
    notificationsRoute: NOTIFICATIONS_ROUTE,
  }),
};
