// Periods of the Gastos por categoría screen (Este mes, Mes anterior, Últimos 3 meses,
// Personalizado). Pure: the screen passes today.
import type { IsoDate } from '@shared/domain';

import { addMonths, firstDayOfMonth, lastDayOfMonth, monthOf, type DateRange } from './dates';

export type SpendingPeriod = 'this_month' | 'last_month' | 'last_3_months' | 'custom';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** The date range of a period, or null when a custom range is invalid. */
export function periodRange(
  period: SpendingPeriod,
  today: IsoDate,
  custom?: { from: string; to: string },
): DateRange | null {
  const month = monthOf(today);
  switch (period) {
    case 'this_month':
      return { from: firstDayOfMonth(month), to: today };
    case 'last_month': {
      const prev = addMonths(month, -1);
      return { from: firstDayOfMonth(prev), to: lastDayOfMonth(prev) };
    }
    case 'last_3_months':
      return { from: firstDayOfMonth(addMonths(month, -2)), to: today };
    case 'custom': {
      if (!custom || !isValidIsoDate(custom.from) || !isValidIsoDate(custom.to)) return null;
      if (custom.from > custom.to) return null;
      return { from: custom.from, to: custom.to };
    }
  }
}

/** Number of days of a range, both ends included. */
export function rangeDays(range: DateRange): number {
  return (
    (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86_400_000 + 1
  );
}
