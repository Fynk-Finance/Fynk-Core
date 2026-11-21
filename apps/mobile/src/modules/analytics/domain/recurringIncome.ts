// Recurring income detection (HU-023). An income source is recurring when the same payer paid at
// least twice in the last 3 months at a regular interval (monthly or biweekly, ± 3 days) and every
// amount is within ± 15 % of the usual amount.
import { normalizeMerchant, type IsoDate, type Transaction } from '@shared/domain';

import { dayOfMonth, daysBetween, inRange, lastDays } from './dates';
import { isIncome, txDate } from './spending';
import type { IncomeCadence, RecurringIncomeSource } from './types';

/** Window looked at: the last 3 months, as 92 days ending today. */
export const RECURRING_INCOME_WINDOW_DAYS = 92;
const TOLERANCE_DAYS = 3;
const BIWEEKLY_DAYS = 15;
const AMOUNT_TOLERANCE_PERCENT = 15;

/** Lower median for integers, so the result stays an integer number of centavos. */
export function medianInt(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? 0;
  return Math.floor(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

export function cadenceOf(gapDays: number): IncomeCadence | null {
  // A calendar month is 28 to 31 days, so the monthly band allows the shortest and longest month.
  if (gapDays >= 28 - TOLERANCE_DAYS && gapDays <= 31 + TOLERANCE_DAYS) return 'monthly';
  if (Math.abs(gapDays - BIWEEKLY_DAYS) <= TOLERANCE_DAYS) return 'biweekly';
  return null;
}

function withinAmountTolerance(amount: number, usual: number): boolean {
  return Math.abs(amount - usual) * 100 <= usual * AMOUNT_TOLERANCE_PERCENT;
}

function payerKey(tx: Transaction): string {
  return tx.merchantKey ?? normalizeMerchant(tx.merchantRaw ?? tx.description);
}

export function recurringIncome(
  txs: readonly Transaction[],
  today: IsoDate,
): RecurringIncomeSource[] {
  const window = lastDays(today, RECURRING_INCOME_WINDOW_DAYS);
  const byPayer = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (!isIncome(tx) || !inRange(txDate(tx), window)) continue;
    const key = payerKey(tx);
    if (!key) continue;
    byPayer.set(key, [...(byPayer.get(key) ?? []), tx]);
  }

  const sources: RecurringIncomeSource[] = [];
  for (const [sourceKey, group] of byPayer) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.bookedAt.localeCompare(b.bookedAt));
    const dates = sorted.map(txDate);
    const amounts = sorted.map((t) => t.amountMinor);
    const usual = medianInt(amounts);
    if (!amounts.every((a) => withinAmountTolerance(a, usual))) continue;

    let cadence: IncomeCadence | null = null;
    let regular = true;
    for (let i = 1; i < dates.length; i++) {
      const gap = cadenceOf(daysBetween(dates[i - 1] as IsoDate, dates[i] as IsoDate));
      if (gap === null || (cadence !== null && gap !== cadence)) {
        regular = false;
        break;
      }
      cadence = gap;
    }
    if (!regular || cadence === null) continue;

    const days = dates.map(dayOfMonth);
    const last = sorted[sorted.length - 1] as Transaction;
    sources.push({
      sourceKey,
      label: last.merchantRaw ?? last.description,
      kind: sorted.some((t) => t.categoryId === 'salary') ? 'salary' : 'other',
      cadence,
      estimatedMonthlyMinor: cadence === 'biweekly' ? usual * 2 : usual,
      usualDay: cadence === 'biweekly' ? Math.min(...days) : medianInt(days),
      occurrences: sorted.length,
      lastOn: txDate(last),
    });
  }
  return sources.sort(
    (a, b) =>
      b.estimatedMonthlyMinor - a.estimatedMonthlyMinor || a.sourceKey.localeCompare(b.sourceKey),
  );
}
