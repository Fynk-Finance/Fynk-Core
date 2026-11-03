// Public API of the transactions module. Other modules import only from this file.
// M5 is the only writer of bank movements (upsertFromSync); M8 links movements to goals.
import type { Id, IsoDate, IsoDateTime, Transaction } from '@shared/domain/types';
import { appEvents } from '@shared/events/appEvents';
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

import { getVaultDb, registerVaultMigrations } from '@modules/vault';

import { transactionsMigrations } from './adapters/vault/migrations';
import { createVaultTransactionsStore } from './adapters/vault/vaultTransactionsStore';
import { createTransactionsService } from './application/transactionsService';
import type { PageRequest, TransactionFilter, TransactionPage } from './domain/query';

export type { PageRequest, TransactionFilter, TransactionPage };
export type { TransactionCursor } from './domain/query';
export { TransactionNotFoundError } from './application/transactionsService';
export { InvalidSyncedTransactionError } from './domain/syncedTransactions';

registerVaultMigrations('transactions', transactionsMigrations);

const service = createTransactionsService({
  store: () => createVaultTransactionsStore(getVaultDb()),
  events: appEvents,
});

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

/** One movement, or null. */
export const getTransaction = (id: Id): Promise<Transaction | null> => service.getTransaction(id);

// Placeholder route from M0 until the Movimientos screen lands (feature/transactions-list-screen).
export const routes: ModuleRoutes = {
  module: 'transactions',
  screens: [
    {
      name: 'transactions.All',
      component: createPlaceholderScreen({ title: 'Movimientos', owner: 'M7 · Movimientos' }),
      path: 'movimientos',
    },
  ],
};
