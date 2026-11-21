import { formatCop } from '@shared/domain';

import { DESIGN_TODAY, designInputs } from '../testing/designFixture';
import { cop, tx } from '../testing/txFactory';
import {
  categoryIncrease,
  opportunities,
  roundUpTo,
  savingOpportunities,
  totalMonthlySaving,
} from './opportunities';
import { opportunitiesFrom } from './snapshot';

describe('categoryIncrease', () => {
  it('finds the 30 % restaurant increase of the design: $45.000 a month', () => {
    const [restaurants, ...rest] = categoryIncrease(designInputs().transactions, DESIGN_TODAY);
    expect(rest).toEqual([]);
    expect(restaurants).toEqual({
      categoryId: 'restaurants',
      last30dMinor: cop(195_000),
      prev30dMinor: cop(150_000),
      increaseMinor: cop(45_000),
      increasePercent: 30,
    });
    expect(formatCop(restaurants?.increaseMinor ?? 0)).toBe('$45.000');
  });

  it('needs at least 20 % and at least $20.000', () => {
    const today = '2026-10-28';
    const txs = [
      // +19.000 (+19 %): below both limits.
      tx('2026-09-10', -100_000, 'cinema'),
      tx('2026-10-10', -119_000, 'cinema'),
      // +25.000 but only +10 %.
      tx('2026-09-10', -250_000, 'shopping'),
      tx('2026-10-10', -275_000, 'shopping'),
      // +20.000 and +20 % exactly: counts.
      tx('2026-09-10', -100_000, 'treats'),
      tx('2026-10-10', -120_000, 'treats'),
      // New spending with nothing before is not an increase.
      tx('2026-10-10', -500_000, 'education'),
    ];
    expect(categoryIncrease(txs, today).map((c) => [c.categoryId, c.increasePercent])).toEqual([
      ['treats', 20],
    ]);
  });
});

describe('opportunities', () => {
  it('lists subscriptions, the category increase and the payday contribution, without transport', () => {
    const list = opportunitiesFrom(designInputs(), DESIGN_TODAY);
    expect(list.map((o) => [o.factKey, o.monthlyMinor])).toEqual([
      ['subscriptions.low_use', cop(56_800)],
      ['category_increase.restaurants', cop(45_000)],
      ['payday_contribution', cop(300_000)],
    ]);
    expect(list.some((o) => o.categoryId === 'transport')).toBe(false);
  });

  it('adds the donut up to $101.800 in 2 fronts (payday is not a saving)', () => {
    const list = opportunitiesFrom(designInputs(), DESIGN_TODAY);
    expect(savingOpportunities(list)).toHaveLength(2);
    expect(formatCop(totalMonthlySaving(list))).toBe('$101.800');
  });

  it('suggests a cap from the previous 30 days rounded up to the next $10.000', () => {
    const list = opportunitiesFrom(designInputs(), DESIGN_TODAY);
    const restaurants = list.find((o) => o.kind === 'category_increase');
    expect(restaurants?.detail).toMatchObject({
      suggestedCapMinor: cop(150_000),
      increasePercent: 30,
    });
    expect(roundUpTo(cop(151_000), cop(10_000))).toBe(cop(160_000));
  });

  it('carries the usual payday for the reminder', () => {
    const payday = opportunitiesFrom(designInputs(), DESIGN_TODAY).find(
      (o) => o.kind === 'payday_contribution',
    );
    expect(payday?.detail).toMatchObject({
      usualDay: 30,
      monthsEarlier: 2,
      goalId: 'goal-cartagena',
    });
  });

  it('skips subscriptions when none is marked as low use', () => {
    const list = opportunities({
      increases: [],
      subscriptions: {
        count: 4,
        monthlyMinor: cop(112_600),
        lowUseCount: 0,
        lowUseMonthlyMinor: 0,
      },
      payday: null,
      usualPayday: null,
    });
    expect(list).toEqual([]);
  });
});
