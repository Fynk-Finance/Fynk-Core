// Aggregate snapshot (docs/modules/00-shared-contracts.md, section 3.5).
// Built by M10 and sent by M11. It is the only financial object that leaves the device:
// no merchant names, no account numbers, no individual transactions and no goal names.
import type { CategoryId, IsoDate, MoneyMinor } from './types';

export interface AggregateSnapshot {
  schemaVersion: 1;
  periodEnd: IsoDate;
  months: 12;
  monthlyIncomeMinor: MoneyMinor[]; // oldest first, length 12
  monthlySpendMinor: MoneyMinor[];
  spendByCategory: { categoryId: CategoryId; last30dMinor: MoneyMinor; prev30dMinor: MoneyMinor }[];
  recurringIncome: { kind: 'salary' | 'other'; monthlyMinor: MoneyMinor }[];
  fixedExpensesMonthlyMinor: MoneyMinor;
  subscriptions: {
    count: number;
    monthlyMinor: MoneyMinor;
    lowUseCount: number;
    lowUseMonthlyMinor: MoneyMinor;
  };
  goals: {
    ref: string;
    categoryId: CategoryId;
    targetMinor: MoneyMinor;
    savedMinor: MoneyMinor;
    monthsLeft: number;
    onTrack: boolean;
  }[];
  caps: {
    categoryId: CategoryId;
    period: 'week' | 'month';
    capMinor: MoneyMinor;
    spentMinor: MoneyMinor;
  }[];
  opportunities: {
    factKey: string;
    kind: 'subscriptions' | 'category_increase' | 'payday_contribution';
    categoryId: CategoryId | null;
    monthlyMinor: MoneyMinor;
  }[];
}
