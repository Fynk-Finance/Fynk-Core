// What the Dashboard card and Detalle de cuentas show (HU-012, HU-014). Pure functions.
import type { Account, AccountKind, Id, MoneyMinor, Transaction } from '@shared/domain/types';

import { balanceContribution, isActive, sortAccounts } from './netWorth';
import { bogotaDate } from './syncedAccounts';

export interface AccountRow {
  id: Id;
  /** The bank or wallet: "Banco Demo" from "Banco Demo · Ahorros". */
  entity: string;
  kind: AccountKind;
  last4: string | null;
  /** What the account adds to the balance total, so the rows add up to it (cards are negative). */
  amountMinor: MoneyMinor;
  isSimulated: boolean;
}

export const entityOf = (a: Account): string => a.displayName.split(' · ')[0]!.trim();

/** The rows of Detalle de cuentas: every account in the total, in display order. No CDTs. */
export function accountRows(accounts: readonly Account[]): AccountRow[] {
  return sortAccounts(accounts.filter((a) => isActive(a) && a.kind !== 'cdt')).map((a) => ({
    id: a.id,
    entity: entityOf(a),
    kind: a.kind,
    last4: a.last4,
    amountMinor: balanceContribution(a),
    isSimulated: a.isSimulated,
  }));
}

export interface MonthSummary {
  incomeMinor: MoneyMinor;
  spendingMinor: MoneyMinor;
}

/**
 * Ingresos and Gastos of the calendar month of `now` in Bogotá, from booked movements.
 * TODO(M10) temporary: the card switches to M10's getMonthSummary() when it lands.
 */
export function monthSummary(transactions: readonly Transaction[], now: Date): MonthSummary {
  const month = bogotaDate(now).slice(0, 7);
  let incomeMinor = 0;
  let spendingMinor = 0;
  for (const t of transactions) {
    if (t.status !== 'booked' || bogotaDate(new Date(t.bookedAt)).slice(0, 7) !== month) continue;
    if (t.amountMinor > 0) incomeMinor += t.amountMinor;
    else spendingMinor -= t.amountMinor;
  }
  return { incomeMinor, spendingMinor };
}
