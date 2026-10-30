// What the Dashboard card shows (HU-014). Pure functions.
import type { MoneyMinor, Transaction } from '@shared/domain/types';

import { bogotaDate } from './syncedAccounts';

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
