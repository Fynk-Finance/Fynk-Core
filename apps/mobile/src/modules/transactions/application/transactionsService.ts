// Use cases of the transactions module. M5 writes the movements of a sync; M8 links a movement
// to a goal; everyone else reads.
import type {
  CategoryId,
  Id,
  IsoDate,
  IsoDateTime,
  MoneyMinor,
  Transaction,
} from '@shared/domain/types';
import type { AppEvents } from '@shared/events/appEvents';

import { categorize } from '../domain/categorize';
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

/** Matches searchTransactions gives at most, newest first. */
export const SEARCH_LIMIT = 50;

export interface TransactionsServiceDeps {
  /** Called on every use: the vault can be locked and opened again while the app runs. */
  store: () => TransactionsStore;
  events: Pick<AppEvents, 'emit'>;
  /** The Antojos threshold of M10 ($20.000 by default). */
  treatsThreshold: () => Promise<MoneyMinor>;
  /** M9's merchant catalog, when it is available. */
  catalogCategory?: (merchantKey: string) => CategoryId | null;
}

export interface TransactionsService {
  upsertFromSync(input: {
    accountId: Id;
    since: IsoDateTime;
    transactions: Transaction[];
  }): Promise<{ newIds: Id[] }>;
  queryTransactions(filter: TransactionFilter, page?: PageRequest): Promise<TransactionPage>;
  summarize(filter: TransactionFilter): Promise<TransactionSummary>;
  searchTransactions(text: string): Promise<Transaction[]>;
  getTransactionsBetween(from: IsoDate, to: IsoDate): Promise<Transaction[]>;
  getTransaction(id: Id): Promise<Transaction | null>;
  setTransactionGoal(id: Id, goalId: Id | null): Promise<void>;
  /**
   * Runs the categorization pipeline on these movements (the new ids of a sync). Never touches
   * a category the person picked. Emits transactions.changed with the ids that changed.
   */
  categorizeNew(ids: Id[]): Promise<Id[]>;
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

    async searchTransactions(text) {
      if (!text.trim()) return [];
      return deps.store().page(toStoreQuery({ text }), null, SEARCH_LIMIT);
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

    async categorizeNew(ids) {
      if (ids.length === 0) return [];
      const store = deps.store();
      const order = new Map(ids.map((id, i) => [id, i]));
      const rows = (await store.getMany(ids))
        .filter((t) => t.categorySource !== 'user')
        .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
      if (rows.length === 0) return [];
      const overrides = await store.overridesFor({
        providerTxIds: rows.flatMap((t) => (t.providerTxId ? [t.providerTxId] : [])),
        merchantKeys: rows.flatMap((t) => (t.merchantKey ? [t.merchantKey] : [])),
      });
      const ctx = {
        ...overrides,
        catalog: deps.catalogCategory,
        treatsThresholdMinor: await deps.treatsThreshold(),
      };
      const changes = rows.flatMap((t) => {
        const result = categorize(t, ctx);
        return result.categoryId === t.categoryId && result.categorySource === t.categorySource
          ? []
          : [{ id: t.id, ...result }];
      });
      await store.setCategories(changes);
      const changed = changes.map((c) => c.id);
      if (changed.length > 0) deps.events.emit({ type: 'transactions.changed', ids: changed });
      return changed;
    },

    async setTransactionGoal(id, goalId) {
      if (!(await deps.store().setGoal(id, goalId))) throw new TransactionNotFoundError();
      deps.events.emit({ type: 'transactions.changed', ids: [id] });
    },
  };
}
