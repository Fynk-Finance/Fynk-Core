// A savings goal as the person enters it (SCRUM-51): name, category, target and deadline month,
// and what Metas shows for it. Pure: today is a Bogotá date from the caller's clock.
import type { Id, IsoDate, IsoDateTime, MoneyMinor } from '@shared/domain/types';

import {
  monthsLeft,
  progressPercent,
  remaining,
  suggestedMonthly,
  type GoalCategory,
  type YearMonthText,
} from './goals';

export const GOAL_CATEGORIES: readonly GoalCategory[] = [
  'travel',
  'emergency',
  'education',
  'home',
  'vehicle',
  'other',
];

export interface GoalInput {
  name: string;
  category: GoalCategory;
  targetMinor: MoneyMinor;
  /** 'YYYY-MM', the month the person wants to reach it ("Jun 2027"). */
  deadline: YearMonthText;
}

export interface Goal extends GoalInput {
  id: Id;
  createdAt: IsoDateTime;
}

/** A goal with the numbers of its card ("$3.200.000 de $5.000.000", "64 %", "$625.000/mes"). */
export interface GoalSummary extends Goal {
  savedMinor: MoneyMinor;
  percent: number;
  remainingMinor: MoneyMinor;
  monthsLeft: number;
  suggestedMonthlyMinor: MoneyMinor;
  done: boolean;
}

export type GoalField = 'name' | 'target' | 'deadline';
export type GoalError =
  | 'name_required'
  | 'name_too_long'
  | 'target_required'
  | 'target_too_large'
  | 'deadline_invalid'
  | 'deadline_past';

export const GOAL_NAME_MAX = 40;
/** $1.000.000.000 in centavos: anything above is surely a typo. */
export const GOAL_TARGET_MAX: MoneyMinor = 100_000_000_000;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

/**
 * Field errors, empty when the goal can be saved. The deadline can be this month (one month
 * left) but not an earlier one.
 */
export function validateGoal(
  input: GoalInput,
  today: IsoDate,
): Partial<Record<GoalField, GoalError>> {
  const errors: Partial<Record<GoalField, GoalError>> = {};
  const name = input.name.trim();
  if (!name) errors.name = 'name_required';
  else if (name.length > GOAL_NAME_MAX) errors.name = 'name_too_long';

  if (!Number.isSafeInteger(input.targetMinor) || input.targetMinor <= 0)
    errors.target = 'target_required';
  else if (input.targetMinor > GOAL_TARGET_MAX) errors.target = 'target_too_large';

  if (!MONTH.test(input.deadline)) errors.deadline = 'deadline_invalid';
  else if (input.deadline < today.slice(0, 7)) errors.deadline = 'deadline_past';
  return errors;
}

export function summarizeGoal(goal: Goal, savedMinor: MoneyMinor, today: IsoDate): GoalSummary {
  const months = monthsLeft(today, goal.deadline);
  const missing = remaining(goal.targetMinor, savedMinor);
  return {
    ...goal,
    savedMinor,
    percent: progressPercent(goal.targetMinor, savedMinor),
    remainingMinor: missing,
    monthsLeft: months,
    suggestedMonthlyMinor: suggestedMonthly(goal.targetMinor, savedMinor, months),
    done: missing === 0,
  };
}

/** "Próximas metas · Por fecha límite": nearest deadline first, then the oldest goal. */
export function byDeadline(a: Goal, b: Goal): number {
  if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}
