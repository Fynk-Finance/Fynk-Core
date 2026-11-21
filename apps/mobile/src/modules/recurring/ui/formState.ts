// What the person types in the recurring form, and how it becomes a RecurringInput. Pure, so the
// form rules are tested without rendering. The form offers the periodicities of SCRUM-54
// (mensual, semanal, diaria); biweekly and yearly items come only from detection.
import type { CategoryId } from '@shared/domain/types';
import { parseCopInput } from '@shared/domain/money';

import {
  validateRecurring,
  type RecurringError,
  type RecurringField,
  type RecurringInput,
  type StoredRecurringItem,
} from '../domain/item';
import {
  MON_TO_FRI,
  WEEKDAY,
  type RecurringKind,
  type Schedule,
  type Usage,
} from '../domain/types';

export type FormPeriodicity = 'monthly' | 'weekly' | 'daily';

export interface RecurringForm {
  name: string;
  kind: RecurringKind;
  categoryId: CategoryId;
  /** As typed: "$1.400.000", "1400000". */
  amount: string;
  periodicity: FormPeriodicity;
  /** Monthly: the day as typed. */
  day: string;
  /** Weekly and daily: the weekday mask. */
  weekdaysMask: number;
  reminderEnabled: boolean;
  /** "¿Cuánto la usas?", only kept for subscriptions. */
  usage: Usage | null;
}

/** Categories the form offers, in this order. */
export const FORM_CATEGORIES: readonly CategoryId[] = [
  'rent',
  'utilities',
  'telecom',
  'subscriptions',
  'transport',
  'gym',
  'health',
  'education',
  'other',
];

export const emptyForm = (): RecurringForm => ({
  name: '',
  kind: 'fixed',
  categoryId: 'other',
  amount: '',
  periodicity: 'monthly',
  day: '',
  weekdaysMask: WEEKDAY.mon,
  reminderEnabled: true,
  usage: null,
});

/** Groups the digits of a peso amount: 1400000 → "$1.400.000". */
function amountText(minor: number): string {
  const pesos = Math.round(minor / 100);
  return `$${String(pesos).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function formFromItem(item: StoredRecurringItem): RecurringForm {
  const s = item.schedule;
  return {
    name: item.name,
    kind: item.kind,
    categoryId: item.categoryId,
    amount: amountText(item.amountMinor),
    periodicity:
      s.periodicity === 'weekly' || s.periodicity === 'daily' ? s.periodicity : 'monthly',
    day: s.periodicity === 'monthly' ? String(s.anchorDay) : '',
    weekdaysMask:
      s.periodicity === 'weekly' || s.periodicity === 'daily' ? s.weekdaysMask : WEEKDAY.mon,
    reminderEnabled: item.reminderEnabled,
    usage: item.usage,
  };
}

/** Changing to daily starts with Monday to Friday; to weekly, with the first chosen day. */
export function withPeriodicity(form: RecurringForm, periodicity: FormPeriodicity): RecurringForm {
  if (periodicity === form.periodicity) return form;
  if (periodicity === 'daily') return { ...form, periodicity, weekdaysMask: MON_TO_FRI };
  if (periodicity === 'weekly') {
    const first = [1, 2, 3, 4, 5, 6, 0].find((d) => form.weekdaysMask & (1 << d)) ?? 1;
    return { ...form, periodicity, weekdaysMask: 1 << first };
  }
  return { ...form, periodicity };
}

function scheduleOf(form: RecurringForm): Schedule {
  if (form.periodicity === 'monthly') {
    const day = /^\d{1,2}$/.test(form.day.trim()) ? Number(form.day.trim()) : 0;
    return { periodicity: 'monthly', anchorDay: day };
  }
  return { periodicity: form.periodicity, weekdaysMask: form.weekdaysMask };
}

/** The input to save, or the error of each field. */
export function readForm(
  form: RecurringForm,
):
  | { ok: true; input: RecurringInput }
  | { ok: false; errors: Partial<Record<RecurringField, RecurringError>> } {
  const amount = parseCopInput(form.amount);
  const input: RecurringInput = {
    kind: form.kind,
    name: form.name,
    amountMinor: amount ?? 0,
    schedule: scheduleOf(form),
    categoryId: form.categoryId,
    reminderEnabled: form.reminderEnabled,
    usage: form.kind === 'subscription' ? form.usage : null,
  };
  const errors = validateRecurring(input);
  return Object.keys(errors).length === 0 ? { ok: true, input } : { ok: false, errors };
}
