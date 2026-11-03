// What M10 (analytics) and M11 (recommendations) read from the savings goals: each goal as the
// aggregate snapshot describes it, and the "Aporte automático" of Recomendaciones ("Programa
// $300.000 para Viaje a Cartagena el día de tu salario · Meta 2 meses antes"). Pure.
import type { CategoryId, Id, MoneyMinor } from '@shared/domain/types';

import type { GoalSummary } from './goal';
import type { GoalCategory } from './goals';

/** Shared contracts 3.5 `goals[]`; `name` is for the screen only and never in the snapshot. */
export interface GoalForAnalytics {
  id: Id;
  name: string;
  categoryId: CategoryId;
  targetMinor: MoneyMinor;
  savedMinor: MoneyMinor;
  monthsLeft: number;
  onTrack: boolean;
}

export interface PaydaySuggestion {
  goalId: Id;
  goalName: string;
  amountMinor: MoneyMinor;
  /** How many months earlier the goal is reached with this amount every payday. */
  monthsEarlier: number;
}

/** Goals use their own categories; the snapshot speaks the movement categories. */
const SNAPSHOT_CATEGORY: Record<GoalCategory, CategoryId> = {
  travel: 'savings',
  emergency: 'savings',
  education: 'education',
  home: 'savings',
  vehicle: 'savings',
  other: 'savings',
};

export function goalForAnalytics(goal: GoalSummary): GoalForAnalytics {
  return {
    id: goal.id,
    name: goal.name,
    categoryId: SNAPSHOT_CATEGORY[goal.category],
    targetMinor: goal.targetMinor,
    savedMinor: goal.savedMinor,
    monthsLeft: goal.monthsLeft,
    onTrack: goal.pace.status !== 'behind',
  };
}

/** $100.000 in centavos: the payday amount is a round number above the suggested one. */
const STEP: MoneyMinor = 10_000_000;

/**
 * The payday aporte for one goal: the next multiple of $100.000 above its suggested monthly
 * amount, and how many months earlier that reaches the goal. Null when it does not shorten it.
 * Viaje a Cartagena ($1.800.000 left, 8 months, $225.000 suggested) gives $300.000, 2 months.
 */
export function paydayFor(goal: GoalSummary): PaydaySuggestion | null {
  if (goal.done || goal.suggestedMonthlyMinor <= 0) return null;
  const amountMinor = (Math.floor(goal.suggestedMonthlyMinor / STEP) + 1) * STEP;
  const monthsNeeded = Math.ceil(goal.remainingMinor / amountMinor);
  const monthsEarlier = goal.monthsLeft - monthsNeeded;
  if (monthsEarlier < 1) return null;
  return { goalId: goal.id, goalName: goal.name, amountMinor, monthsEarlier };
}

/** The suggestion of Recomendaciones: the goal with the nearest deadline that it shortens. */
export function paydayContribution(goals: readonly GoalSummary[]): PaydaySuggestion | null {
  for (const goal of goals) {
    const suggestion = paydayFor(goal);
    if (suggestion) return suggestion;
  }
  return null;
}
