// Step 2 · Cuentas (OnbCuentas, SCRUM-69): the rows of "Cuentas bancarias", the cash already
// saved, and "Total registrado" while the person types the cash. M6 owns which account counts as
// connected and the balance total; this file only puts them together for the step. Pure.
import type { Account, AccountKind, MoneyMinor } from '@shared/domain/types';

/** One row of M5's BankLinkList. Cash has its own field, so it is never a row. */
export interface LinkedAccountRow {
  id: string;
  displayName: string;
  kind: Exclude<AccountKind, 'cash'>;
  balanceMinor: MoneyMinor;
}

/** The connected accounts, in the order M6 gives them (`isConnected` comes from M6). */
export function linkedAccountRows(
  accounts: readonly Account[],
  isConnected: (account: Account) => boolean,
): LinkedAccountRow[] {
  const rows: LinkedAccountRow[] = [];
  for (const a of accounts) {
    if (!isConnected(a) || a.kind === 'cash') continue;
    rows.push({ id: a.id, displayName: a.displayName, kind: a.kind, balanceMinor: a.balanceMinor });
  }
  return rows;
}

/** The cash the person registered before, or null when there is none. */
export function savedCashMinor(accounts: readonly Account[]): MoneyMinor | null {
  return accounts.find((a) => a.kind === 'cash')?.balanceMinor ?? null;
}

/**
 * "Total registrado": M6's balance total, with the typed cash in place of the saved one, so the
 * box follows the field before anything is saved.
 */
export function registeredTotal(
  balanceTotalMinor: MoneyMinor,
  savedCash: MoneyMinor | null,
  typedCash: MoneyMinor | null,
): MoneyMinor {
  return balanceTotalMinor - (savedCash ?? 0) + (typedCash ?? 0);
}

/** The amount "Continuar" has to save, or null when the field is empty or unchanged. */
export function cashToSave(savedCash: MoneyMinor | null, typedCash: MoneyMinor | null) {
  return typedCash !== null && typedCash !== savedCash ? typedCash : null;
}
