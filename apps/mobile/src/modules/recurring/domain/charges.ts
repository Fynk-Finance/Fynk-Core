// The account or card of a recurring item and its last charges in M7's movements (M9 prompt:
// "show the account or card it is charged to and link to its movements"). Pure.
import type { Account, Transaction } from '@shared/domain/types';

import type { StoredRecurringItem } from './item';

/** How many charges Detalle de suscripción shows (M9 prompt: last 6 charges from M7). */
export const LAST_CHARGES = 6;

/**
 * The booked charges of the item, newest first. Only an item that came from detection has a
 * merchant to match; one typed by hand has none, so it gets no charges.
 */
export function lastCharges(
  item: Pick<StoredRecurringItem, 'merchantKey'>,
  transactions: readonly Transaction[],
  limit = LAST_CHARGES,
): Transaction[] {
  if (!item.merchantKey) return [];
  return transactions
    .filter((t) => t.merchantKey === item.merchantKey && t.amountMinor < 0 && t.status === 'booked')
    .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt) || b.id.localeCompare(a.id))
    .slice(0, limit);
}

/** The account the item is charged to, or null when it has none or the account is gone. */
export function chargedAccount(
  item: Pick<StoredRecurringItem, 'accountId'>,
  accounts: readonly Account[],
): Account | null {
  if (!item.accountId) return null;
  return accounts.find((a) => a.id === item.accountId) ?? null;
}
