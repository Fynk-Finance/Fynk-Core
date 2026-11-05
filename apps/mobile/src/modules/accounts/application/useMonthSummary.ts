// Ingresos and Gastos of the Dashboard card, taken from M10's month summary of the current
// calendar month. M6 does not calculate them.
import type { MoneyMinor } from '@shared/domain/types';

import type { MonthSummary } from '../domain/dashboard';

/** What the card reads from M10's useMonthSummary(). */
export interface MonthSummarySource {
  data?: { incomeMinor: MoneyMinor; spendingMinor: MoneyMinor };
}

/** null until M10 has the numbers, so the pills show a skeleton like the balance total. */
export function createUseMonthSummary(useSource: () => MonthSummarySource) {
  return function useMonthSummary(): MonthSummary | null {
    const { data } = useSource();
    return data ? { incomeMinor: data.incomeMinor, spendingMinor: data.spendingMinor } : null;
  };
}
