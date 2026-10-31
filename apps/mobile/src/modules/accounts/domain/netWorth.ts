// Balance total and connected accounts (HU-012, HU-014). Pure functions on the Account list.
//
// Balance total = savings + checking + wallets + cash − what is owed on credit cards.
// Only active accounts count. CDTs never count: investment data stays in the Inversión tab.
import type { Account, AccountKind, MoneyMinor } from '@shared/domain/types';

export interface ConnectedAccountsSummary {
  /** Active bank accounts, cards and wallets. Cash and CDTs are not counted. */
  count: number;
  /** The balance total, cash included. */
  totalMinor: MoneyMinor;
}

const ASSET_KINDS: ReadonlySet<AccountKind> = new Set(['savings', 'checking', 'wallet', 'cash']);

export const isActive = (a: Account): boolean => a.status === 'active';

/** What one account adds to the balance total: its balance, minus the debt of a card, or 0. */
export function balanceContribution(a: Account): MoneyMinor {
  if (!isActive(a)) return 0;
  if (ASSET_KINDS.has(a.kind)) return a.balanceMinor;
  // A card's balanceMinor is the amount owed, always positive (shared contract, section 2).
  if (a.kind === 'credit_card') return -a.balanceMinor;
  return 0;
}

export function balanceTotal(accounts: readonly Account[]): MoneyMinor {
  return accounts.reduce((sum, a) => sum + balanceContribution(a), 0);
}

/** "N cuentas conectadas": active accounts that come from a bank or wallet, without CDTs. */
export const isConnected = (a: Account): boolean =>
  isActive(a) && a.provider !== 'manual' && a.kind !== 'cash' && a.kind !== 'cdt';

export function connectedAccountsSummary(accounts: readonly Account[]): ConnectedAccountsSummary {
  return {
    count: accounts.filter(isConnected).length,
    totalMinor: balanceTotal(accounts),
  };
}

const KIND_ORDER: Record<AccountKind, number> = {
  savings: 0,
  checking: 1,
  wallet: 2,
  credit_card: 3,
  cdt: 4,
  cash: 5,
};

/** Bank accounts first, then wallets, cards, CDTs and cash last. Stable by name, then id. */
export function sortAccounts(accounts: readonly Account[]): Account[] {
  return [...accounts].sort(
    (a, b) =>
      KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
      a.displayName.localeCompare(b.displayName, 'es-CO') ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
