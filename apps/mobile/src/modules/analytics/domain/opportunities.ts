// Saving opportunities (Recomendaciones). Every number on that screen comes from here, never from
// the model. Rules decided on 25 Oct 2026: subscriptions with low use (M9), categories that went
// up, and a contribution on payday (M8). There is no transport plan.
import type { CategoryId, IsoDate, MoneyMinor, Transaction } from '@shared/domain';

import { addDays, lastDays } from './dates';
import { spendingIn } from './spending';
import type {
  CategoryIncrease,
  Opportunity,
  PaydayContribution,
  SubscriptionSummary,
} from './types';
import { NON_SPENDING_CATEGORIES } from './types';

/** A category went up when it grew at least 20 % … */
export const INCREASE_MIN_PERCENT = 20;
/** … and at least $20.000 (in centavos). */
export const INCREASE_MIN_MINOR = 2_000_000;
/** Suggested caps are rounded up to the next $10.000. */
export const CAP_ROUNDING_MINOR = 1_000_000;

export function roundUpTo(amount: MoneyMinor, step: MoneyMinor): MoneyMinor {
  if (amount <= 0) return step;
  return Math.ceil(amount / step) * step;
}

/** The 30 days ending today, and the 30 days before them. */
export function comparisonWindows(today: IsoDate) {
  const last30 = lastDays(today, 30);
  const prev30 = lastDays(addDays(today, -30), 30);
  return { last30, prev30 };
}

/** Spending of every category in the last 30 days and the 30 days before. */
export function spendLast30VsPrev30(
  txs: readonly Transaction[],
  today: IsoDate,
): { categoryId: CategoryId; last30dMinor: MoneyMinor; prev30dMinor: MoneyMinor }[] {
  const { last30, prev30 } = comparisonWindows(today);
  const categories = new Set<CategoryId>();
  for (const tx of txs) {
    if (tx.amountMinor < 0 && !NON_SPENDING_CATEGORIES.includes(tx.categoryId)) {
      categories.add(tx.categoryId);
    }
  }
  return [...categories]
    .sort()
    .map((categoryId) => ({
      categoryId,
      last30dMinor: spendingIn(txs, last30, categoryId),
      prev30dMinor: spendingIn(txs, prev30, categoryId),
    }))
    .filter((c) => c.last30dMinor > 0 || c.prev30dMinor > 0);
}

/**
 * Categories whose last 30 days are at least 20 % and at least $20.000 above the 30 days before.
 * A category with nothing in the 30 days before is new spending, not an increase.
 */
export function categoryIncrease(txs: readonly Transaction[], today: IsoDate): CategoryIncrease[] {
  return spendLast30VsPrev30(txs, today)
    .filter(({ last30dMinor: last, prev30dMinor: prev }) => {
      const increase = last - prev;
      return (
        prev > 0 && increase >= INCREASE_MIN_MINOR && increase * 100 >= prev * INCREASE_MIN_PERCENT
      );
    })
    .map(({ categoryId, last30dMinor, prev30dMinor }) => {
      const increaseMinor = last30dMinor - prev30dMinor;
      return {
        categoryId,
        last30dMinor,
        prev30dMinor,
        increaseMinor,
        increasePercent: Math.round((increaseMinor * 100) / prev30dMinor),
      };
    })
    .sort((a, b) => b.increaseMinor - a.increaseMinor || a.categoryId.localeCompare(b.categoryId));
}

export interface OpportunityInputs {
  increases: readonly CategoryIncrease[];
  subscriptions: SubscriptionSummary | null;
  payday: PaydayContribution | null;
  /** Usual payday from recurringIncome(), for the reminder. */
  usualPayday: number | null;
}

export const FACT_KEYS = {
  subscriptions: 'subscriptions.low_use',
  categoryIncrease: (categoryId: CategoryId) => `category_increase.${categoryId}`,
  payday: 'payday_contribution',
} as const;

/**
 * Every opportunity, savings first (highest monthly saving first), then the payday contribution.
 */
export function opportunities(input: OpportunityInputs): Opportunity[] {
  const savings: Opportunity[] = [];
  const subs = input.subscriptions;
  if (subs && subs.lowUseCount > 0 && subs.lowUseMonthlyMinor > 0) {
    savings.push({
      factKey: FACT_KEYS.subscriptions,
      kind: 'subscriptions',
      categoryId: 'subscriptions',
      monthlyMinor: subs.lowUseMonthlyMinor,
      detail: {
        kind: 'subscriptions',
        count: subs.count,
        totalMonthlyMinor: subs.monthlyMinor,
        lowUseCount: subs.lowUseCount,
      },
    });
  }
  for (const inc of input.increases) {
    savings.push({
      factKey: FACT_KEYS.categoryIncrease(inc.categoryId),
      kind: 'category_increase',
      categoryId: inc.categoryId,
      monthlyMinor: inc.increaseMinor,
      detail: {
        kind: 'category_increase',
        increasePercent: inc.increasePercent,
        last30dMinor: inc.last30dMinor,
        prev30dMinor: inc.prev30dMinor,
        suggestedCapMinor: roundUpTo(inc.prev30dMinor, CAP_ROUNDING_MINOR),
      },
    });
  }
  savings.sort((a, b) => b.monthlyMinor - a.monthlyMinor || a.factKey.localeCompare(b.factKey));

  const out = [...savings];
  const payday = input.payday;
  if (payday && payday.amountMinor > 0) {
    out.push({
      factKey: FACT_KEYS.payday,
      kind: 'payday_contribution',
      categoryId: 'savings',
      monthlyMinor: payday.amountMinor,
      detail: {
        kind: 'payday_contribution',
        goalId: payday.goalId,
        goalName: payday.goalName,
        monthsEarlier: payday.monthsEarlier,
        usualDay: input.usualPayday,
      },
    });
  }
  return out;
}

/** The opportunities that are a monthly saving (the donut "Podrías ahorrar en N frentes"). */
export function savingOpportunities(all: readonly Opportunity[]): Opportunity[] {
  return all.filter((o) => o.kind !== 'payday_contribution');
}

/** Total of the donut. */
export function totalMonthlySaving(all: readonly Opportunity[]): MoneyMinor {
  return savingOpportunities(all).reduce((a, o) => a + o.monthlyMinor, 0);
}
