// Public API of the accounts module. Other modules import only from this file.
// M5 is the only writer (upsertFromSync, markLinkRevoked); everyone else reads.
import { randomUUID } from 'expo-crypto';
import { createElement } from 'react';

import type { Account, Clock, Id, IsoDate, MoneyMinor } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import { registerSlot, type ModuleRoutes } from '@shared/navigation';

import { STATISTICS_ROUTE, useMonthSummary as useAnalyticsMonthSummary } from '@modules/analytics';
import { disconnectLink, syncNow } from '@modules/bank';
import { NOTIFICATIONS_ROUTE, useUnreadCount } from '@modules/notifications';
import { useDisplayName } from '@modules/onboarding';
import { GoalsCarousel } from '@modules/savings';
import { NEW_TRANSACTION_ROUTE, TransactionList, TransactionPreview } from '@modules/transactions';
import {
  getVaultDb,
  markDirty,
  registerBackupCollection,
  registerVaultMigrations,
} from '@modules/vault';

import { accountsMigrations } from './adapters/vault/migrations';
import { createVaultAccountsStore } from './adapters/vault/vaultAccountsStore';
import { createVaultCashStore } from './adapters/vault/vaultCashStore';
import { createAccountsService, type AccountsOverview } from './application/accountsService';
import { createCashService } from './application/cashService';
import { createManualBalanceService } from './application/manualBalanceService';
import type { BalancePoint, Cash } from './application/ports';
import { ACCOUNTS_QUERY_KEY, createUseAccounts } from './application/useAccounts';
import { createUseMonthSummary } from './application/useMonthSummary';
import type { ManualEffect, ManualMovementChange } from './domain/manualBalance';
import type { ConnectedAccountsSummary } from './domain/netWorth';
import { ACCOUNT_DETAIL_ROUTE, createAccountDetailScreen } from './ui/AccountDetailScreen';
import { createDashboardScreen } from './ui/DashboardScreen';
import { createMisCuentasBilletera, createMisCuentasMiCuenta } from './ui/MisCuentas';

export type { AccountsOverview, BalancePoint, Cash, ConnectedAccountsSummary };
export type { ManualEffect, ManualMovementChange };
export type { CashInputProps } from './ui/CashInput';
export { ACCOUNTS_QUERY_KEY, ACCOUNT_DETAIL_ROUTE };
export type { AccountDetailParams } from './ui/AccountDetailScreen';
export { maskedNumber } from './domain/masking';
/** Whether an account counts as connected (onboarding Cuentas lists the same ones it counts). */
export { isConnected } from './domain/netWorth';
export { InvalidCashAmountError } from './domain/cash';
export { InsufficientCashError } from './domain/manualBalance';
export { InvalidSyncedAccountError } from './domain/syncedAccounts';
export { CashInput } from './ui/CashInput';

registerVaultMigrations('accounts', accountsMigrations);

const clock: Clock = { now: () => new Date() };

const service = createAccountsService({
  store: () => createVaultAccountsStore(getVaultDb()),
  clock,
});

const cash = createCashService({
  store: () => createVaultCashStore(getVaultDb()),
  clock,
  newId: randomUUID,
  markDirty,
  onChanged: service.notifyChanged,
});

// Cash goes into M2's encrypted backup; setCash marks every change dirty there.
registerBackupCollection(cash.backupCollection);

const manualBalances = createManualBalanceService({
  store: () => createVaultAccountsStore(getVaultDb()),
  setCash: cash.setCash,
  onChanged: service.notifyChanged,
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

// ---- Cash (HU-054) ----

/** The registered cash, or null before the person registers any (M3 prefills CashInput). */
export const getCash = (): Promise<Cash | null> => cash.getCash();

/** Registers or updates cash. Throws InvalidCashAmountError below zero or with decimals. */
export const setCash = (amountMinor: MoneyMinor): Promise<void> => cash.setCash(amountMinor);

/**
 * The cash account's id, registering cash at $0 first when there is none. M7's sheet calls it
 * when someone who skipped cash adds a movement in Efectivo (QA review 2026-11-07, F5).
 */
export const ensureCashAccount = (): Promise<Id> => cash.ensureCash();

// ---- Manual movements, for M7 only ----

/**
 * Applies a manual movement to the balance of its account: a Gasto subtracts and an Ingreso
 * adds, on cash and on disconnected accounts. Connected accounts keep their bank's balance.
 * Pass the movement before and after (null on add or delete) with signed amounts. Throws
 * InsufficientCashError, writing nothing, when cash would go below $0.
 */
export const applyManualMovement = (change: ManualMovementChange): Promise<void> =>
  manualBalances.applyManualMovement(change);

// ---- Mis cuentas, rendered by other modules ----

/** "Mis cuentas" of Billetera (M9): rendered above "Gastos recurrentes". */
export const MisCuentasBilletera = createMisCuentasBilletera({ useAccounts });

/** "Mis cuentas" of Mi cuenta (M1), shown through the slot after "Información Básica". */
export const MisCuentasMiCuenta = createMisCuentasMiCuenta({ useAccounts });
// M1 renders <Slot name="miCuenta.misCuentas" />: importing this module from identity would
// close an import cycle (vault imports identity).
registerSlot('miCuenta.misCuentas', MisCuentasMiCuenta);

// Ingresos and Gastos of this month come from M10, which src/app/startup.ts configures.
const useMonthSummary = createUseMonthSummary(() => useAnalyticsMonthSummary());

export const routes: ModuleRoutes = {
  module: 'accounts',
  // The Dashboard tab (tabOwners in src/app/registry.ts).
  tab: createDashboardScreen({
    useAccounts,
    useMonthSummary,
    useUnreadCount,
    // The name typed in onboarding, read only when the screen renders (safe in an import cycle).
    useDisplayName: () => useDisplayName(),
    accountRoute: 'identity.Account',
    notificationsRoute: NOTIFICATIONS_ROUTE,
    statisticsRoute: STATISTICS_ROUTE,
    // M8 and M7 import this module too (M8 through M7): their values are read only when the
    // screen renders.
    renderGoals: () => createElement(GoalsCarousel),
    renderMovements: () => createElement(TransactionPreview),
    newMovementRoute: () => NEW_TRANSACTION_ROUTE,
    // M5 imports this module too: pull to refresh (HU-011) calls its sync only on a pull.
    refresh: () => syncNow(),
  }),
  screens: [
    {
      // Detalle de cuenta, from a row of Detalle de cuentas: { accountId }.
      name: ACCOUNT_DETAIL_ROUTE,
      component: createAccountDetailScreen({
        useAccounts,
        clock,
        renderTransactions: (accountId) =>
          createElement(TransactionList, { filter: { accountIds: [accountId] } }),
        // "Eliminar cuenta" (HU-008): M5 ends the link; called only on a press.
        disconnect: (linkId) => disconnectLink(linkId),
      }),
      path: 'cuentas/:accountId',
      transition: 'modal',
    },
  ],
};
