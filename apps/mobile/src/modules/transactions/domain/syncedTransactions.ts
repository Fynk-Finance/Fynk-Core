// Checks the movements M5 hands over after a sync, before anything is written.
import type { Id, Transaction } from '@shared/domain/types';

import { canonicalInstant } from './bogota';

export class InvalidSyncedTransactionError extends Error {
  constructor(reason: string) {
    super(`Invalid synced movement: ${reason}`);
    this.name = 'InvalidSyncedTransactionError';
  }
}

/** The movements of one account, with UTC instants in the stored form. Throws on the first bad one. */
export function cleanSyncedTransactions(accountId: Id, transactions: Transaction[]): Transaction[] {
  const seen = new Set<string>();
  return transactions.map((tx, index) => {
    const at = `#${index}`;
    if (tx.accountId !== accountId) throw new InvalidSyncedTransactionError(`${at} other account`);
    if (tx.source !== 'bank' || !tx.providerTxId) {
      throw new InvalidSyncedTransactionError(`${at} has no bank id`);
    }
    if (seen.has(tx.providerTxId)) throw new InvalidSyncedTransactionError(`${at} repeated`);
    seen.add(tx.providerTxId);
    if (!Number.isSafeInteger(tx.amountMinor)) {
      throw new InvalidSyncedTransactionError(`${at} amount is not whole centavos`);
    }
    if (tx.status !== 'booked' && tx.status !== 'pending') {
      throw new InvalidSyncedTransactionError(`${at} unknown status`);
    }
    return { ...tx, bookedAt: canonicalInstant(tx.bookedAt) };
  });
}
