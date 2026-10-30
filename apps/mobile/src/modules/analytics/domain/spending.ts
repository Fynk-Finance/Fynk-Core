// Income, spending, spending by category and trends. Pure functions over the movements of the
// vault; every amount is an integer number of centavos.
import type { CategoryId, IsoDate, MoneyMinor, Transaction } from '@shared/domain';

import {
  addMonths,
  bogotaDate,
  firstDayOfMonth,
  inRange,
  lastDayOfMonth,
  type DateRange,
  type MonthKey,
} from './dates';
import {
  NON_INCOME_CATEGORIES,
  NON_SPENDING_CATEGORIES,
  type CategorySpend,
  type MonthSummary,
  type SpendByCategory,
  type Trend,
} from './types';

/** Money out that counts as spending (not a transfer, card payment or saving). */
export function isSpending(tx: Transaction): boolean {
  return tx.amountMinor < 0 && !NON_SPENDING_CATEGORIES.includes(tx.categoryId);
}

/** Money in that counts as income (not a transfer between own accounts or a card payment). */
export function isIncome(tx: Transaction): boolean {
  return tx.amountMinor > 0 && !NON_INCOME_CATEGORIES.includes(tx.categoryId);
}

/** The Bogotá day a movement was booked. */
export function txDate(tx: Transaction): IsoDate {
  return bogotaDate(tx.bookedAt);
}

function sumWhere(
  txs: readonly Transaction[],
  range: DateRange,
  pick: (tx: Transaction) => boolean,
): MoneyMinor {
  let total = 0;
  for (const tx of txs) {
    if (pick(tx) && inRange(txDate(tx), range)) total += Math.abs(tx.amountMinor);
  }
  return total;
}

export function monthRange(month: MonthKey): DateRange {
  return { from: firstDayOfMonth(month), to: lastDayOfMonth(month) };
}

export function incomeIn(txs: readonly Transaction[], range: DateRange): MoneyMinor {
  return sumWhere(txs, range, isIncome);
}

export function spendingIn(
  txs: readonly Transaction[],
  range: DateRange,
  categoryId?: CategoryId,
): MoneyMinor {
  return sumWhere(
    txs,
    range,
    (tx) => isSpending(tx) && (categoryId === undefined || tx.categoryId === categoryId),
  );
}

/** Income and spending of a calendar month in Bogotá. */
export function monthSummary(txs: readonly Transaction[], month: MonthKey): MonthSummary {
  const range = monthRange(month);
  const incomeMinor = incomeIn(txs, range);
  const spendingMinor = spendingIn(txs, range);
  return { month, incomeMinor, spendingMinor, balanceMinor: incomeMinor - spendingMinor };
}

/**
 * Whole percents that always add up to 100 (largest remainder method), so a donut and its legend
 * never disagree. Ties go to the earlier item.
 */
export function wholeShares(amounts: readonly number[]): number[] {
  const total = amounts.reduce((a, b) => a + b, 0);
  if (total <= 0) return amounts.map(() => 0);
  const exact = amounts.map((a) => (a * 100) / total);
  const shares = exact.map(Math.floor);
  let left = 100 - shares.reduce((a, b) => a + b, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    shares[index] = (shares[index] ?? 0) + 1;
    left -= 1;
  }
  return shares;
}

/** Spending between two days (both included), grouped by category, highest first. */
export function spendByCategory(
  txs: readonly Transaction[],
  from: IsoDate,
  to: IsoDate,
): SpendByCategory {
  const range = { from, to };
  const byCategory = new Map<CategoryId, { amountMinor: number; count: number }>();
  for (const tx of txs) {
    if (!isSpending(tx) || !inRange(txDate(tx), range)) continue;
    const entry = byCategory.get(tx.categoryId) ?? { amountMinor: 0, count: 0 };
    entry.amountMinor += -tx.amountMinor;
    entry.count += 1;
    byCategory.set(tx.categoryId, entry);
  }
  const sorted = [...byCategory.entries()]
    .map(([categoryId, v]) => ({ categoryId, ...v }))
    .sort((a, b) => b.amountMinor - a.amountMinor || a.categoryId.localeCompare(b.categoryId));
  const shares = wholeShares(sorted.map((c) => c.amountMinor));
  const categories: CategorySpend[] = sorted.map((c, i) => ({
    ...c,
    sharePercent: shares[i] ?? 0,
  }));
  const totalMinor = categories.reduce((a, c) => a + c.amountMinor, 0);
  return { from, to, totalMinor, categories };
}

/** Whole percent change from `before` to `after`, rounded half away from zero. */
export function percentChange(before: MoneyMinor, after: MoneyMinor): number | null {
  if (before === 0) return null;
  const raw = ((after - before) * 100) / before;
  return Math.sign(raw) * Math.round(Math.abs(raw));
}

/**
 * Monthly spending for the `months` calendar months that end with `endMonth` (oldest first), for
 * all spending or one category, plus the change of the last month against the one before.
 */
export function trend(
  txs: readonly Transaction[],
  categoryId: CategoryId | 'all',
  months: number,
  endMonth: MonthKey,
): Trend {
  if (!Number.isInteger(months) || months < 1) throw new RangeError('months must be at least 1');
  const points = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = addMonths(endMonth, -i);
    const amountMinor = spendingIn(
      txs,
      monthRange(month),
      categoryId === 'all' ? undefined : categoryId,
    );
    points.push({ month, amountMinor });
  }
  const last = points[points.length - 1];
  const before = points[points.length - 2];
  const changePercent = last && before ? percentChange(before.amountMinor, last.amountMinor) : null;
  return { categoryId, points, changePercent };
}

/** Income and spending of each of the 12 months ending with `endMonth`, oldest first. */
export function monthlySeries(
  txs: readonly Transaction[],
  endMonth: MonthKey,
  months = 12,
): MonthSummary[] {
  const out: MonthSummary[] = [];
  for (let i = months - 1; i >= 0; i--) out.push(monthSummary(txs, addMonths(endMonth, -i)));
  return out;
}

/** Average spending per day over `days` days, rounded down to the centavo. */
export function dailyAverageMinor(totalMinor: MoneyMinor, days: number): MoneyMinor {
  if (days <= 0) return 0;
  return Math.floor(totalMinor / days);
}
