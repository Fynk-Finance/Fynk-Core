// The aggregate snapshot (shared contracts 3.5): the only financial object that leaves the phone.
// It is built only from totals. It never carries merchant names, payer names, account ids, goal
// names, descriptions or single movements.
import type { AggregateSnapshot, IsoDate, MoneyMinor, Transaction } from '@shared/domain';

import { capStatus } from './caps';
import { addMonths, firstDayOfMonth, monthOf } from './dates';
import { categoryIncrease, opportunities, spendLast30VsPrev30 } from './opportunities';
import { recurringIncome } from './recurringIncome';
import { monthlySeries } from './spending';
import type {
  GoalSummary,
  Opportunity,
  PaydayContribution,
  SpendingCap,
  SubscriptionSummary,
} from './types';

export interface AnalyticsInputs {
  /** Movements of at least the last 12 months (more is fine, they are filtered by date). */
  transactions: readonly Transaction[];
  subscriptions: SubscriptionSummary | null;
  fixedExpensesMonthlyMinor: MoneyMinor;
  goals: readonly GoalSummary[];
  caps: readonly SpendingCap[];
  payday: PaydayContribution | null;
}

/** Opportunities from the inputs, the same list the snapshot and the screen use. */
export function opportunitiesFrom(input: AnalyticsInputs, today: IsoDate): Opportunity[] {
  const income = recurringIncome(input.transactions, today);
  const salary = income.find((s) => s.kind === 'salary') ?? income[0] ?? null;
  return opportunities({
    increases: categoryIncrease(input.transactions, today),
    subscriptions: input.subscriptions,
    payday: input.payday,
    usualPayday: salary?.usualDay ?? null,
  });
}

export function buildSnapshot(input: AnalyticsInputs, today: IsoDate): AggregateSnapshot {
  const txs = input.transactions;
  const series = monthlySeries(txs, monthOf(today), 12);
  const subs = input.subscriptions ?? {
    count: 0,
    monthlyMinor: 0,
    lowUseCount: 0,
    lowUseMonthlyMinor: 0,
  };
  // Goals are referred to by position only; their names and ids stay on the phone.
  const goals = [...input.goals]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((g, i) => ({
      ref: `goal_${i + 1}`,
      categoryId: g.categoryId,
      targetMinor: g.targetMinor,
      savedMinor: g.savedMinor,
      monthsLeft: g.monthsLeft,
      onTrack: g.onTrack,
    }));

  return {
    schemaVersion: 1,
    periodEnd: today,
    months: 12,
    monthlyIncomeMinor: series.map((m) => m.incomeMinor),
    monthlySpendMinor: series.map((m) => m.spendingMinor),
    spendByCategory: spendLast30VsPrev30(txs, today),
    recurringIncome: recurringIncome(txs, today).map((s) => ({
      kind: s.kind,
      monthlyMinor: s.estimatedMonthlyMinor,
    })),
    fixedExpensesMonthlyMinor: input.fixedExpensesMonthlyMinor,
    subscriptions: {
      count: subs.count,
      monthlyMinor: subs.monthlyMinor,
      lowUseCount: subs.lowUseCount,
      lowUseMonthlyMinor: subs.lowUseMonthlyMinor,
    },
    goals,
    caps: input.caps.map((cap) => ({
      categoryId: cap.categoryId,
      period: cap.period,
      capMinor: cap.capMinor,
      spentMinor: capStatus(cap, txs, today).spentMinor,
    })),
    opportunities: opportunitiesFrom(input, today).map((o) => ({
      factKey: o.factKey,
      kind: o.kind,
      categoryId: o.categoryId,
      monthlyMinor: o.monthlyMinor,
    })),
  };
}

/** First and last day of the data the snapshot looked at (traceability line on screen). */
export function snapshotDataRange(snapshot: AggregateSnapshot): { from: IsoDate; to: IsoDate } {
  const firstMonth = addMonths(monthOf(snapshot.periodEnd), -(snapshot.months - 1));
  return { from: firstDayOfMonth(firstMonth), to: snapshot.periodEnd };
}
