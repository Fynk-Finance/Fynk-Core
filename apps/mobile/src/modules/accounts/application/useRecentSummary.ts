// Ingresos and Gastos of the Dashboard card: money in and out of the last 30 days, summed by M7
// with the filter "Ingresos" and "Gastos" open Movimientos with, so the card and the list always
// agree. M6 does not calculate them.
import type { Clock, MoneyMinor } from '@shared/domain/types';

import type { RecentSummary } from '../domain/dashboard';

/** What the card reads from M7's useTransactionSummary(). */
export interface RecentTotalsSource {
  /** spendMinor is money out, as a negative number. */
  data?: { incomeMinor: MoneyMinor; spendMinor: MoneyMinor };
}

export interface RecentSummaryDeps<F> {
  useTotals: (filter: F) => RecentTotalsSource;
  /** The last 30 days ending today (M7's recentFilter). */
  recentFilter: (now: Date) => F;
  clock: Clock;
}

/** null until M7 has the numbers, so the pills show a skeleton like the balance total. */
export function createUseRecentSummary<F>({
  useTotals,
  recentFilter,
  clock,
}: RecentSummaryDeps<F>) {
  return function useRecentSummary(): RecentSummary | null {
    // Only days: the query key stays the same between renders of one day.
    const { data } = useTotals(recentFilter(clock.now()));
    return data
      ? { incomeMinor: data.incomeMinor, spendingMinor: Math.abs(data.spendMinor) }
      : null;
  };
}
