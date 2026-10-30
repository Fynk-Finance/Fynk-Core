import { formatCop } from '@shared/domain';

import { cop, tx } from '../testing/txFactory';
import { bogotaDate, weekStart } from './dates';
import {
  dailyAverageMinor,
  monthSummary,
  percentChange,
  spendByCategory,
  trend,
  wholeShares,
} from './spending';

describe('dates in Bogotá', () => {
  it('moves an instant after midnight UTC back to the Bogotá day', () => {
    expect(bogotaDate('2026-10-01T03:00:00Z')).toBe('2026-09-30');
    expect(bogotaDate('2026-10-01T05:00:00Z')).toBe('2026-10-01');
  });

  it('starts the week on Monday', () => {
    expect(weekStart('2026-10-28')).toBe('2026-10-26'); // Wednesday
    expect(weekStart('2026-11-01')).toBe('2026-10-26'); // Sunday
    expect(weekStart('2026-10-26')).toBe('2026-10-26'); // Monday
  });
});

describe('monthSummary (HU-021 cálculos correctos)', () => {
  const txs = [
    tx('2026-10-01', 5_580_000, 'salary'),
    tx('2026-10-02', -1_400_000, 'rent'),
    tx('2026-10-03', -2_082_400, 'groceries'),
    // Excluded from income: own transfers and card payments.
    tx('2026-10-04', 1_000_000, 'transfers'),
    tx('2026-10-04', 200_000, 'card_payment'),
    // Excluded from spending: transfers, card payments, savings.
    tx('2026-10-04', -1_000_000, 'transfers'),
    tx('2026-10-05', -500_000, 'card_payment'),
    tx('2026-10-06', -300_000, 'savings'),
    // Another month.
    tx('2026-09-30', -99_000, 'groceries'),
  ];

  it('adds income and spending of the month and gives the balance of Estadísticas', () => {
    const summary = monthSummary(txs, '2026-10');
    expect(summary).toEqual({
      month: '2026-10',
      incomeMinor: cop(5_580_000),
      spendingMinor: cop(3_482_400),
      balanceMinor: cop(2_097_600),
    });
    expect(formatCop(summary.balanceMinor)).toBe('$2.097.600');
  });

  it('uses the Bogotá day: 1 Nov 02:00 UTC is still October', () => {
    const late = { ...tx('2026-10-31', -10_000, 'treats'), bookedAt: '2026-11-01T02:00:00Z' };
    expect(monthSummary([late], '2026-10').spendingMinor).toBe(cop(10_000));
    expect(monthSummary([late], '2026-11').spendingMinor).toBe(0);
  });
});

describe('spendByCategory (HU-021 distribución de gastos)', () => {
  // Estadísticas reference: total $3.482.400 and 40 %, 18 %, 12 %, 9 %, 8 %, 13 %.
  const txs = [
    tx('2026-10-01', -1_400_000, 'rent'),
    tx('2026-10-05', -400_000, 'groceries'),
    tx('2026-10-12', -227_000, 'groceries'),
    tx('2026-10-06', -418_000, 'transport'),
    tx('2026-10-07', -313_400, 'cinema'),
    tx('2026-10-08', -278_600, 'utilities'),
    tx('2026-10-09', -445_400, 'other'),
    tx('2026-10-09', -300_000, 'savings'), // not spending
    tx('2026-09-28', -50_000, 'other'), // out of the period
  ];

  it('groups by category, highest first, with shares that add up to 100', () => {
    const result = spendByCategory(txs, '2026-09-29', '2026-10-28');
    expect(result.totalMinor).toBe(cop(3_482_400));
    expect(formatCop(result.totalMinor)).toBe('$3.482.400');
    expect(result.categories.map((c) => [c.categoryId, c.amountMinor, c.sharePercent])).toEqual([
      ['rent', cop(1_400_000), 40],
      ['groceries', cop(627_000), 18],
      ['other', cop(445_400), 13],
      ['transport', cop(418_000), 12],
      ['cinema', cop(313_400), 9],
      ['utilities', cop(278_600), 8],
    ]);
    expect(result.categories.find((c) => c.categoryId === 'groceries')?.count).toBe(2);
  });

  it('gives the daily average of the last 30 days', () => {
    const total = spendByCategory(txs, '2026-09-29', '2026-10-28').totalMinor;
    expect(formatCop(dailyAverageMinor(total, 30))).toBe('$116.080');
  });

  it('returns an empty list for a period without spending', () => {
    expect(spendByCategory(txs, '2025-01-01', '2025-01-31')).toEqual({
      from: '2025-01-01',
      to: '2025-01-31',
      totalMinor: 0,
      categories: [],
    });
  });

  it('wholeShares always adds up to 100', () => {
    expect(wholeShares([1, 1, 1])).toEqual([34, 33, 33]);
    expect(wholeShares([0, 0])).toEqual([0, 0]);
  });
});

describe('trend (HU-022 tendencias)', () => {
  const txs = [
    tx('2026-08-15', -100_000, 'restaurants'),
    tx('2026-09-15', -150_000, 'restaurants'),
    tx('2026-10-15', -195_000, 'restaurants'),
    tx('2026-10-16', -50_000, 'groceries'),
  ];

  it('gives the monthly totals oldest first and the month over month change', () => {
    const t = trend(txs, 'restaurants', 3, '2026-10');
    expect(t.points).toEqual([
      { month: '2026-08', amountMinor: cop(100_000) },
      { month: '2026-09', amountMinor: cop(150_000) },
      { month: '2026-10', amountMinor: cop(195_000) },
    ]);
    expect(t.changePercent).toBe(30);
  });

  it('adds every category for "all" and spans across the year', () => {
    const t = trend(txs, 'all', 12, '2026-10');
    expect(t.points).toHaveLength(12);
    expect(t.points[0]?.month).toBe('2025-11');
    expect(t.points[11]).toEqual({ month: '2026-10', amountMinor: cop(245_000) });
  });

  it('has no change when the month before is zero', () => {
    expect(trend(txs, 'groceries', 2, '2026-10').changePercent).toBeNull();
    expect(percentChange(cop(200), cop(150))).toBe(-25);
  });
});
