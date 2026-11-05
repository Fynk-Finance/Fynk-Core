// What the transactions use cases need from the outside world.
import type { CategoryId, Id, IsoDateTime, MoneyMinor, Transaction } from '@shared/domain/types';
import type { BackupRecord } from '@shared/ports';

import type { CategoryChange, CategoryOverride } from '../domain/categoryChange';
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
  /** The movements with these ids that exist, in any order. */
  getMany(ids: Id[]): Promise<Transaction[]>;
  /** The person's categories for these bank ids and merchant keys. */
  overridesFor(keys: { providerTxIds: string[]; merchantKeys: string[] }): Promise<{
    txOverrides: Map<string, CategoryId>;
    merchantOverrides: Map<string, CategoryId>;
  }>;
  /** Writes the category of each movement. */
  setCategories(
    changes: { id: Id; categoryId: CategoryId; categorySource: Transaction['categorySource'] }[],
  ): Promise<void>;
  /** Sets or clears the goal of a movement. False when the movement does not exist. */
  setGoal(id: Id, goalId: Id | null): Promise<boolean>;
}

/** Category changes the person makes, their history and the overrides they leave. */
export interface CategoryStore {
  /** Ids of every movement of a merchant. */
  merchantIds(merchantKey: string): Promise<Id[]>;
  /**
   * In one vault transaction: saves the override (its backup version goes up by one), sets the
   * category of each movement as the person's, and writes a history line for each one that
   * really changed. Gives those ids.
   */
  recategorize(input: {
    ids: Id[];
    to: CategoryId;
    at: IsoDateTime;
    newId: () => Id;
    override: Pick<CategoryOverride, 'kind' | 'key'> | null;
  }): Promise<{ changed: Id[] }>;
  /** History of a movement, newest first. */
  history(transactionId: Id): Promise<CategoryChange[]>;
  exportOverrides(): Promise<BackupRecord<CategoryOverride>[]>;
  importOverrides(records: BackupRecord<CategoryOverride>[]): Promise<void>;
}

/** Manual movements and their backup (transactions.manual). Bank rows are never touched. */
/** A manual movement before and after a change, with signed amounts (null on add or delete). */
export interface ManualBalanceChange {
  before: { accountId: Id; amountMinor: MoneyMinor } | null;
  after: { accountId: Id; amountMinor: MoneyMinor } | null;
}

/**
 * M6's applyManualMovement: changes the balance of cash and of disconnected accounts. Rejects,
 * writing nothing, when a Gasto is bigger than the cash.
 */
export interface ManualBalancePort {
  apply(change: ManualBalanceChange): Promise<void>;
}

export interface ManualStore {
  /** Inserts or updates a manual movement; its backup version goes up by one. */
  save(tx: Transaction): Promise<void>;
  /** Deletes a manual movement and leaves a tombstone. False when it is not a manual one. */
  delete(id: Id): Promise<boolean>;
  /** The ids among these that are manual movements. */
  manualIds(ids: Id[]): Promise<Id[]>;
  exportAll(): Promise<BackupRecord<Transaction | null>[]>;
  importAll(records: BackupRecord<Transaction | null>[]): Promise<void>;
}
