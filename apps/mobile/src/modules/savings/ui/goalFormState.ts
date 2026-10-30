// What the person types in the goal form (design OnbMetas), how it becomes a GoalInput, and the
// live "Aporte mensual sugerido" box. Pure, so the form rules are tested without rendering.
import { parseCopInput } from '@shared/domain/money';
import type { IsoDate, MoneyMinor } from '@shared/domain/types';

import {
  summarizeGoal,
  validateGoal,
  type GoalError,
  type GoalField,
  type GoalInput,
  type GoalSummary,
} from '../domain/goal';
import type { GoalCategory, YearMonthText } from '../domain/goals';

export interface GoalForm {
  name: string;
  category: GoalCategory;
  /** As typed: "$5.000.000", "5000000". */
  target: string;
  /** 'YYYY-MM'. */
  deadline: YearMonthText;
}

/** A new goal starts 6 months ahead, a common horizon the person can move. */
const DEFAULT_MONTHS_AHEAD = 6;

export function addMonths(month: YearMonthText, delta: number): YearMonthText {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}

export const emptyGoalForm = (today: IsoDate): GoalForm => ({
  name: '',
  category: 'travel',
  target: '',
  deadline: addMonths(today.slice(0, 7), DEFAULT_MONTHS_AHEAD),
});

/** Groups the digits of a peso amount: 5000000 → "$5.000.000". */
function amountText(minor: MoneyMinor): string {
  const pesos = Math.round(minor / 100);
  return `$${String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function formFromGoal(goal: GoalSummary): GoalForm {
  return {
    name: goal.name,
    category: goal.category,
    target: amountText(goal.targetMinor),
    deadline: goal.deadline,
  };
}

/** The input to save, or the error of each field. */
export function readGoalForm(
  form: GoalForm,
  today: IsoDate,
  keptDeadline?: YearMonthText,
): { ok: true; input: GoalInput } | { ok: false; errors: Partial<Record<GoalField, GoalError>> } {
  const input: GoalInput = {
    name: form.name,
    category: form.category,
    targetMinor: parseCopInput(form.target) ?? 0,
    deadline: form.deadline,
  };
  const errors = validateGoal(input, today);
  // An old goal may keep a deadline that already passed (same rule as the service).
  if (errors.deadline === 'deadline_past' && form.deadline === keptDeadline) delete errors.deadline;
  return Object.keys(errors).length === 0 ? { ok: true, input } : { ok: false, errors };
}

/**
 * "Aporte mensual sugerido · 8 meses para llegar a $5.000.000 · $625.000", or null while the
 * target is not a valid amount yet. `savedMinor` is what the goal already has when editing.
 */
export function suggestionPreview(
  form: GoalForm,
  today: IsoDate,
  savedMinor: MoneyMinor = 0,
): { months: number; targetMinor: MoneyMinor; suggestedMinor: MoneyMinor } | null {
  const targetMinor = parseCopInput(form.target);
  if (targetMinor === null || targetMinor <= 0) return null;
  const s = summarizeGoal({ ...form, targetMinor, id: '', createdAt: '' }, savedMinor, today);
  return { months: s.monthsLeft, targetMinor, suggestedMinor: s.suggestedMonthlyMinor };
}
