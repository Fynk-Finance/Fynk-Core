// Amounts of Billetera (SCRUM-54, SCRUM-56): fixed expenses of this month, the subscriptions
// summary and the low use saving. Pure, integer centavos only.
import type { MoneyMinor } from '@shared/domain/types';

import { occurrencesInMonth } from './schedule';
import type { RecurringItem, YearMonth } from './types';

const active = (items: readonly RecurringItem[]) => items.filter((i) => i.status === 'active');

/** What one item costs in the calendar month: its amount times its charges in that month. */
export function amountInMonth(item: RecurringItem, ym: YearMonth): MoneyMinor {
  return item.amountMinor * occurrencesInMonth(item.schedule, ym);
}

/**
 * "Gastos fijos de este mes": every active item, fixed expenses and subscriptions, counted by
 * its charges inside the month. Cancelled items no longer count.
 */
export function fixedExpensesInMonth(items: readonly RecurringItem[], ym: YearMonth): MoneyMinor {
  return active(items).reduce((sum, item) => sum + amountInMonth(item, ym), 0);
}

export interface SubscriptionsSummary {
  count: number;
  monthlyMinor: MoneyMinor;
  lowUseCount: number;
  /** "Ahorra $56.800 al mes": the monthly amount of the subscriptions marked "Casi nunca". */
  lowUseMonthlyMinor: MoneyMinor;
}

/**
 * "Suscripciones · 4 activas · $112.600/mes" and the savings banner. Same shape as
 * `subscriptions` in the analytics snapshot (shared contracts 3.5).
 */
export function subscriptionsSummary(
  items: readonly RecurringItem[],
  ym: YearMonth,
): SubscriptionsSummary {
  const subscriptions = active(items).filter((i) => i.kind === 'subscription');
  const lowUse = subscriptions.filter((i) => i.usage === 'low');
  const total = (list: RecurringItem[]) => list.reduce((s, i) => s + amountInMonth(i, ym), 0);
  return {
    count: subscriptions.length,
    monthlyMinor: total(subscriptions),
    lowUseCount: lowUse.length,
    lowUseMonthlyMinor: total(lowUse),
  };
}
