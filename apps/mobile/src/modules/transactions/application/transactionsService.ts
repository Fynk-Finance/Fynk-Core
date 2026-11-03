// Use cases of the transactions module. M5 writes the movements of a sync; M8 links a movement
// to a goal; everyone else reads.
import type { Id, IsoDate, IsoDateTime, Transaction } from '@shared/domain/types';
import type { AppEvents } from '@shared/events/appEvents';

import {
  pageLimit,
  toPage,
  toStoreQuery,
  type PageRequest,
  type TransactionFilter,
  type TransactionPage,
  type TransactionSummary,
} from '../domain/query';
import { cleanSyncedTransactions } from '../domain/syncedTransactions';
import type { TransactionsStore } from './ports';

export class TransactionNotFoundError extends Error {
  constructor() {
    super('The movement does not exist');
    this.name = 'TransactionNotFoundError';
  }
}

export interface TransactionsServiceDeps {
  /** Called on every use: the vault can be locked and opened again while the app runs. */
  store: () => TransactionsStore;
  events: Pick<AppEvents, 'emit'>;
}

export interface TransactionsService {
  upsertFromSync(input: {
    accountId: Id;
    since: IsoDateTime;
    transactions: Transaction[];
  }): Promise<{ newIds: Id[] }>;
  queryTransactions(filter: TransactionFilter, page?: PageRequest): Promise<TransactionPage>;
  summarize(filter: TransactionFilter): Promise<TransactionSummary>;
  getTransactionsBetween(from: IsoDate, to: IsoDate): Promise<Transaction[]>;
  getTransaction(id: Id): Promise<Transaction | null>;
  setTransactionGoal(id: Id, goalId: Id | null): Promise<void>;
}

export function createTransactionsService(deps: TransactionsServiceDeps): TransactionsService {
  return {
    async upsertFromSync({ accountId, since, transactions }) {
      const clean = cleanSyncedTransactions(accountId, transactions);
      // M5 emits sync.completed with the new ids once every account is written.
      return deps.store().upsertSynced({ accountId, since, transactions: clean });
    },

    async queryTransactions(filter, page = {}) {
      const limit = pageLimit(page.limit);
      const rows = await deps.store().page(toStoreQuery(filter), page.cursor ?? null, limit + 1);
      return toPage(rows, limit);
    },

    summarize(filter) {
      return deps.store().summary(toStoreQuery(filter));
    },

    async getTransactionsBetween(from, to) {
      return deps.store().list(toStoreQuery({ from, to }));
    },

    getTransaction(id) {
      return deps.store().get(id);
    },

    async setTransactionGoal(id, goalId) {
      if (!(await deps.store().setGoal(id, goalId))) throw new TransactionNotFoundError();
      deps.events.emit({ type: 'transactions.changed', ids: [id] });
    },
  };
}
