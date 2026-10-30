// A savings goal as the person enters it (SCRUM-51): name, category, target and deadline month,
// and what Metas shows for it. Pure: today is a Bogotá date from the caller's clock.
import type { Id, IsoDate, IsoDateTime, MoneyMinor } from '@shared/domain/types';

import {
  monthsLeft,
  pace,
  progressPercent,
  remaining,
  suggestedMonthly,
  type Contribution,
  type GoalCategory,
  type Pace,
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
  /** "Cumplida en ago 2026": the day of the last contribution of a goal already reached. */
  completedOn: IsoDate | null;
  /** "Vas a tiempo" or "Te faltan $X al mes para llegar" (SCRUM-53). */
  pace: Pace;
  /** Whether the goal has any contribution yet. */
  started: boolean;
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

// America/Bogota is UTC-5 all year (Colombia has no daylight saving time).
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

/** The day a goal was created, in Bogotá; today for a goal that is not saved yet. */
function createdOn(goal: Goal, today: IsoDate): IsoDate {
  const time = Date.parse(goal.createdAt);
  if (Number.isNaN(time)) return today;
  return new Date(time + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The numbers of a goal. `recent` are its contributions of the last months, for the pace; with
 * none, the pace counts nothing saved lately.
 */
export function summarizeGoal(
  goal: Goal,
  savedMinor: MoneyMinor,
  today: IsoDate,
  lastContributionOn: IsoDate | null = null,
  recent: readonly Contribution[] = [],
): GoalSummary {
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
    completedOn: missing === 0 ? lastContributionOn : null,
    pace: pace({
      target: goal.targetMinor,
      saved: savedMinor,
      contributions: recent,
      createdOn: createdOn(goal, today),
      deadline: goal.deadline,
      today,
    }),
    started: lastContributionOn !== null,
  };
}

/** "Próximas metas · Por fecha límite": nearest deadline first, then the oldest goal. */
export function byDeadline(a: Goal, b: Goal): number {
  if (a.deadline !== b.deadline) return a.deadline < b.deadline ? -1 : 1;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : 1;
}
