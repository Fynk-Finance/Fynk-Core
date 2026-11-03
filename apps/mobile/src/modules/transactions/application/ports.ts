// What the transactions use cases need from the outside world.
import type { Id, IsoDateTime, Transaction } from '@shared/domain/types';

import type { StoreQuery, TransactionCursor, TransactionSummary } from '../domain/query';

export interface TransactionsStore {
  /**
   * Upserts the movements of one account by (accountId, providerTxId), keeping their category
   * and goal, and deletes the pending ones since `since` that are not in the batch. One vault
   * transaction. Gives the ids that were not in the vault before.
   */
  upsertSynced(input: {
    accountId: Id;
    since: IsoDateTime;
    transactions: Transaction[];
  }): Promise<{ newIds: Id[] }>;
  /** Up to `limit` rows strictly after `cursor`, newest first by (bookedAt, id). */
  page(query: StoreQuery, cursor: TransactionCursor | null, limit: number): Promise<Transaction[]>;
  /** Count, money in and money out of every row of the query. */
  summary(query: StoreQuery): Promise<TransactionSummary>;
  /** Every row of the query, newest first. */
  list(query: StoreQuery): Promise<Transaction[]>;
  get(id: Id): Promise<Transaction | null>;
  /** Sets or clears the goal of a movement. False when the movement does not exist. */
  setGoal(id: Id, goalId: Id | null): Promise<boolean>;
}
