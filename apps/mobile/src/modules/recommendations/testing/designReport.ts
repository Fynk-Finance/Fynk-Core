// The Recomendaciones design numbers as M10 reports them: subscriptions $56.800, restaurants
// $45.000 (+30 %), payday $300.000. Test-only: never import this file from app code.
import type { AggregateSnapshot } from '@shared/domain';
import type { Opportunity } from '@modules/analytics';

export function designReport(): { snapshot: AggregateSnapshot; opportunities: Opportunity[] } {
  const opportunities: Opportunity[] = [
    {
      factKey: 'subscriptions.low_use',
      kind: 'subscriptions',
      categoryId: 'subscriptions',
      monthlyMinor: 5_680_000,
      detail: { kind: 'subscriptions', count: 4, totalMonthlyMinor: 11_260_000, lowUseCount: 2 },
    },
    {
      factKey: 'category_increase.restaurants',
      kind: 'category_increase',
      categoryId: 'restaurants',
      monthlyMinor: 4_500_000,
      detail: {
        kind: 'category_increase',
        increasePercent: 30,
        last30dMinor: 19_500_000,
        prev30dMinor: 15_000_000,
        suggestedCapMinor: 15_000_000,
      },
    },
    {
      factKey: 'payday_contribution',
      kind: 'payday_contribution',
      categoryId: 'savings',
      monthlyMinor: 30_000_000,
      detail: {
        kind: 'payday_contribution',
        goalId: 'goal-cartagena',
        goalName: 'Viaje a Cartagena',
        monthsEarlier: 2,
        usualDay: 30,
      },
    },
  ];
  return {
    opportunities,
    snapshot: {
      schemaVersion: 1,
      periodEnd: '2026-10-28',
      months: 12,
      monthlyIncomeMinor: [0, 0, 0, 0, 0, 0, 0, 0, 558_000_000, 558_000_000, 558_000_000, 0],
      monthlySpendMinor: [0, 0, 0, 0, 0, 0, 0, 0, 0, 40_000_000, 55_000_000, 59_500_000],
      spendByCategory: [
        { categoryId: 'restaurants', last30dMinor: 19_500_000, prev30dMinor: 15_000_000 },
      ],
      recurringIncome: [{ kind: 'salary', monthlyMinor: 558_000_000 }],
      fixedExpensesMonthlyMinor: 193_060_000,
      subscriptions: {
        count: 4,
        monthlyMinor: 11_260_000,
        lowUseCount: 2,
        lowUseMonthlyMinor: 5_680_000,
      },
      goals: [],
      caps: [],
      opportunities: opportunities.map(({ factKey, kind, categoryId, monthlyMinor }) => ({
        factKey,
        kind,
        categoryId,
        monthlyMinor,
      })),
    },
  };
}
