// Public API of the transactions module. Other modules import only from this file.
// M5 is the only writer of bank movements (upsertFromSync); M8 links movements to goals.
import type { Clock, Id, IsoDate, IsoDateTime, Transaction } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import { useAccounts } from '@modules/accounts';
import { syncNow } from '@modules/bank';
import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { transactionsMigrations } from './adapters/vault/migrations';
import { createVaultTransactionsStore } from './adapters/vault/vaultTransactionsStore';
import { createTransactionsService } from './application/transactionsService';
import { createTransactionHooks } from './application/useTransactions';
import type { PageRequest, TransactionFilter, TransactionPage } from './domain/query';
import { createAllTransactionsScreen, TRANSACTIONS_ROUTE } from './ui/AllTransactionsScreen';
import { createFiltersSheet, FILTERS_ROUTE } from './ui/FiltersSheet';
import { createTransactionList } from './ui/TransactionList';
import { createTransactionPreview } from './ui/TransactionPreview';

export type { PageRequest, TransactionFilter, TransactionPage };
export type { TransactionCursor } from './domain/query';
export { TransactionNotFoundError } from './application/transactionsService';
export { TRANSACTIONS_ROUTE };
export type { AllTransactionsParams } from './ui/AllTransactionsScreen';
export type { TransactionListProps } from './ui/TransactionList';
export { InvalidSyncedTransactionError } from './domain/syncedTransactions';

registerVaultMigrations('transactions', transactionsMigrations);

const clock: Clock = { now: () => new Date() };

const service = createTransactionsService({
  store: () => createVaultTransactionsStore(getVaultDb()),
  events: appEvents,
});

const hooks = createTransactionHooks({ service, events: appEvents });

// ---- Write API ----

/**
 * M5's TransactionsSink: saves the movements of one account after a sync. Upserts by
 * (accountId, providerTxId) keeping category and goal, deletes the pending movements since
 * `since` that the bank no longer returns, and gives the new ids for sync.completed. Throws
 * InvalidSyncedTransactionError and writes nothing when a movement is malformed.
 */
export const upsertFromSync = (input: {
  accountId: Id;
  since: IsoDateTime;
  transactions: Transaction[];
}): Promise<{ newIds: Id[] }> => service.upsertFromSync(input);

/**
 * Links a movement to a savings goal, or clears the link with null (M8). Throws
 * TransactionNotFoundError when the movement does not exist. Emits transactions.changed.
 */
export const setTransactionGoal = (id: Id, goalId: Id | null): Promise<void> =>
  service.setTransactionGoal(id, goalId);

// ---- Read API ----

/** One page of movements, newest first. Pass the page's nextCursor to get the next one. */
export const queryTransactions = (
  filter: TransactionFilter,
  page?: PageRequest,
): Promise<TransactionPage> => service.queryTransactions(filter, page);

/** Every movement booked on Bogotá days `from` to `to`, both included, newest first (M9, M10). */
export const getTransactionsBetween = (from: IsoDate, to: IsoDate): Promise<Transaction[]> =>
  service.getTransactionsBetween(from, to);

/**
 * Movements whose description or merchant has every typed word as a prefix, without case or
 * accents ("SUPERMERC" and "supermércado" find "Supermercado"). At most 50, newest first.
 */
export const searchTransactions = (text: string): Promise<Transaction[]> =>
  service.searchTransactions(text);

/** One movement, or null. */
export const getTransaction = (id: Id): Promise<Transaction | null> => service.getTransaction(id);

// ---- Screens ----

// Other modules are used only inside functions, never while this file loads: M5 and M6 import
// this module too, and an import cycle must not see an undefined value (vault/index.ts does
// the same with identity).
/** Movimientos, from "Ver todo" on the Dashboard. */
export const AllTransactionsScreen = createAllTransactionsScreen({
  hooks,
  useAccounts: () => useAccounts(),
  refresh: () => syncNow(),
  clock,
});

/** "Movimientos" of the Dashboard: the 3 latest movements and "Ver todo" (M6). */
export const TransactionPreview = createTransactionPreview({
  hooks,
  useAccounts: () => useAccounts(),
});

/** The movements of a filter, e.g. one account in Detalle de cuenta (M6). */
export const TransactionList = createTransactionList({ hooks });

export const routes: ModuleRoutes = {
  module: 'transactions',
  screens: [
    { name: TRANSACTIONS_ROUTE, component: AllTransactionsScreen, path: 'movimientos' },
    {
      // "Filtros" of Movimientos: a sheet (README, kinds of screen).
      name: FILTERS_ROUTE,
      component: createFiltersSheet({ useAccounts: () => useAccounts(), clock }),
      transition: 'sheet',
    },
  ],
};
