// How a manual movement changes balances (team decision of 5 Nov 2026). Pure functions.
//
// A Gasto subtracts and an Ingreso adds, on cash and on bank accounts that are no longer
// connected. A connected account keeps the balance of its bank: the sync brings the real one.
// Fynk never moves money; this only keeps the numbers on the phone up to date.
import type { Account, Id, MoneyMinor } from '@shared/domain/types';

import { isActive } from './netWorth';

/** The account of a manual movement and its signed amount: negative for a Gasto. */
export interface ManualEffect {
  accountId: Id;
  amountMinor: MoneyMinor;
}

/** A manual movement before and after a change: null `before` on add, null `after` on delete. */
export interface ManualMovementChange {
  before: ManualEffect | null;
  after: ManualEffect | null;
}

export interface ManualBalanceUpdate {
  account: Account;
  balanceMinor: MoneyMinor;
  availableMinor: MoneyMinor | null;
}

export class InsufficientCashError extends Error {
  /** The cash the person has now. */
  constructor(readonly cashMinor: MoneyMinor) {
    super('The Gasto is bigger than the cash');
    this.name = 'InsufficientCashError';
  }
}

/** Whose balance follows manual movements: cash, a disconnected account, or nobody (null). */
export function balanceOwner(a: Account): 'cash' | 'disconnected' | null {
  if (a.kind === 'cash') return isActive(a) ? 'cash' : null;
  if (a.provider === 'manual' || a.kind === 'cdt') return null;
  return a.status === 'revoked' || a.status === 'closed' ? 'disconnected' : null;
}

/** What each account gains or loses: the old effect taken back, the new one applied. */
export function netDeltas(change: ManualMovementChange): Map<Id, MoneyMinor> {
  const deltas = new Map<Id, MoneyMinor>();
  const add = (e: ManualEffect | null, sign: 1 | -1) => {
    if (e) deltas.set(e.accountId, (deltas.get(e.accountId) ?? 0) + sign * e.amountMinor);
  };
  add(change.before, -1);
  add(change.after, 1);
  for (const [id, delta] of deltas) if (delta === 0) deltas.delete(id);
  return deltas;
}

/**
 * The new balances a change gives, in the order of `accounts`. Connected and unknown accounts
 * are left out. Throws InsufficientCashError when cash would go below $0.
 */
export function manualBalanceUpdates(
  accounts: readonly Account[],
  change: ManualMovementChange,
): ManualBalanceUpdate[] {
  const deltas = netDeltas(change);
  const updates: ManualBalanceUpdate[] = [];
  for (const a of accounts) {
    const delta = deltas.get(a.id);
    const owner = balanceOwner(a);
    if (delta === undefined || owner === null) continue;
    if (a.kind === 'credit_card') {
      // A card's balance is what is owed: a Gasto raises it and uses up credit.
      updates.push({
        account: a,
        balanceMinor: a.balanceMinor - delta,
        availableMinor: a.availableMinor === null ? null : a.availableMinor + delta,
      });
      continue;
    }
    const balanceMinor = a.balanceMinor + delta;
    if (owner === 'cash' && balanceMinor < 0) throw new InsufficientCashError(a.balanceMinor);
    updates.push({
      account: a,
      balanceMinor,
      availableMinor: a.availableMinor === null ? null : a.availableMinor + delta,
    });
  }
  return updates;
}
