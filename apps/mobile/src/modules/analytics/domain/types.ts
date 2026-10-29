// Domain types of the analytics module (M10). The inputs that come from other modules
// (M8 savings, M9 recurring) are described here as plain data, so the domain stays pure and the
// application layer reads them through ports.
import type { CategoryId, Id, IsoDate, MoneyMinor } from '@shared/domain';

/** Categories that are never spending: money moved between own accounts, card payments, savings. */
export const NON_SPENDING_CATEGORIES: readonly CategoryId[] = [
  'transfers',
  'card_payment',
  'savings',
];

/** Categories that are never income: money moved between own accounts and card payments. */
export const NON_INCOME_CATEGORIES: readonly CategoryId[] = ['transfers', 'card_payment'];

/** Income and spending of one calendar month (Dashboard pills). */
export interface MonthSummary {
  month: string; // YYYY-MM
  incomeMinor: MoneyMinor;
  spendingMinor: MoneyMinor;
  balanceMinor: MoneyMinor; // income - spending
}

export interface CategorySpend {
  categoryId: CategoryId;
  amountMinor: MoneyMinor; // positive
  count: number;
  /** Whole percent of the total; the shares of a list always add up to 100. */
  sharePercent: number;
}

export interface SpendByCategory {
  from: IsoDate;
  to: IsoDate;
  totalMinor: MoneyMinor;
  categories: CategorySpend[]; // sorted by amount, highest first
}

export interface TrendPoint {
  month: string; // YYYY-MM
  amountMinor: MoneyMinor;
}

export interface Trend {
  categoryId: CategoryId | 'all';
  points: TrendPoint[]; // oldest first
  /** Last month against the one before, whole percent. Null when the month before is zero. */
  changePercent: number | null;
}

export type IncomeCadence = 'monthly' | 'biweekly';

export interface RecurringIncomeSource {
  sourceKey: string; // normalized payer, stays on the phone
  label: string; // 'Nómina Empresa Demo', shown on screen only
  kind: 'salary' | 'other';
  cadence: IncomeCadence;
  estimatedMonthlyMinor: MoneyMinor;
  usualDay: number; // day of month, used by M8 for the payday reminder
  occurrences: number;
  lastOn: IsoDate;
}

export interface CategoryIncrease {
  categoryId: CategoryId;
  last30dMinor: MoneyMinor;
  prev30dMinor: MoneyMinor;
  increaseMinor: MoneyMinor;
  increasePercent: number; // whole percent, rounded half up
}

/** Summary of subscriptions from M9 (Billetera). */
export interface SubscriptionSummary {
  count: number;
  monthlyMinor: MoneyMinor;
  lowUseCount: number;
  lowUseMonthlyMinor: MoneyMinor;
}

/** A savings goal as M8 sees it. `name` never leaves the phone. */
export interface GoalSummary {
  id: Id;
  name: string;
  categoryId: CategoryId;
  targetMinor: MoneyMinor;
  savedMinor: MoneyMinor;
  monthsLeft: number;
  onTrack: boolean;
}

/** M8's suggestion of a contribution on payday. */
export interface PaydayContribution {
  goalId: Id;
  goalName: string; // shown on screen only, never in the snapshot
  amountMinor: MoneyMinor;
  /** How many months earlier the goal is reached with the contribution. */
  monthsEarlier: number;
}

export type OpportunityKind = 'subscriptions' | 'category_increase' | 'payday_contribution';

/** A saving opportunity. Every number shown in Recomendaciones comes from one of these. */
export interface Opportunity {
  factKey: string; // stable key the model uses to attach its text
  kind: OpportunityKind;
  categoryId: CategoryId | null;
  /** Monthly saving for subscriptions and category increases, the contribution for payday. */
  monthlyMinor: MoneyMinor;
  /** Extra facts for the screen (never sent to the model). */
  detail:
    | { kind: 'subscriptions'; count: number; totalMonthlyMinor: MoneyMinor; lowUseCount: number }
    | {
        kind: 'category_increase';
        increasePercent: number;
        last30dMinor: MoneyMinor;
        prev30dMinor: MoneyMinor;
        suggestedCapMinor: MoneyMinor;
      }
    | {
        kind: 'payday_contribution';
        goalId: Id;
        goalName: string;
        monthsEarlier: number;
        usualDay: number | null;
      };
}

export type CapPeriod = 'week' | 'month';

export interface SpendingCap {
  id: Id;
  categoryId: CategoryId;
  period: CapPeriod;
  capMinor: MoneyMinor;
  createdAt: string;
}

export type CapState = 'ok' | 'warning' | 'reached';

export interface CapStatus {
  cap: SpendingCap;
  periodKey: string; // 'week:2026-10-26' or 'month:2026-10'
  from: IsoDate;
  to: IsoDate;
  spentMinor: MoneyMinor;
  percent: number; // whole percent, rounded down
  state: CapState;
}
