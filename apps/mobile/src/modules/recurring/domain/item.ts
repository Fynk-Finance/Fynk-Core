// A recurring item as the person enters it (SCRUM-54): name, type, amount, periodicity and the
// day it is charged. Pure validation; the form shows the errors next to each field.
import type { CategoryId, Id, IsoDate, IsoDateTime, MoneyMinor } from '@shared/domain/types';

import type { RecurringItem, Schedule, Usage } from './types';

/** The stored item: the fields Billetera and the reminders need besides the amounts. */
export interface StoredRecurringItem extends RecurringItem {
  categoryId: CategoryId;
  /** Account or card it is charged to, null when the person did not say. */
  accountId: Id | null;
  /** Normalized merchant of a detected item (M9 detection), null when entered by hand. */
  merchantKey: string | null;
  source: 'manual' | 'detected';
  reminderEnabled: boolean;
  createdAt: IsoDateTime;
}

export interface RecurringInput {
  kind: RecurringItem['kind'];
  name: string;
  amountMinor: MoneyMinor;
  schedule: Schedule;
  categoryId: CategoryId;
  accountId?: Id | null;
  reminderEnabled?: boolean;
  /**
   * "¿Cuánto la usas?" (SCRUM-56), only for subscriptions. Left out, an edit keeps the current
   * mark; null clears it. A fixed expense never has one.
   */
  usage?: Usage | null;
}

export type RecurringField = 'name' | 'amount' | 'schedule';
export type RecurringError =
  | 'name_required'
  | 'name_too_long'
  | 'amount_required'
  | 'amount_too_large'
  | 'day_invalid'
  | 'weekdays_required'
  | 'date_invalid';

export const NAME_MAX = 40;
/** $100.000.000 in centavos: anything above is surely a typo. */
export const AMOUNT_MAX: MoneyMinor = 10_000_000_000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(date: IsoDate): boolean {
  if (!ISO_DATE.test(date)) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().startsWith(date);
}

/** Field errors, empty when the item can be saved. */
export function validateRecurring(
  input: RecurringInput,
): Partial<Record<RecurringField, RecurringError>> {
  const errors: Partial<Record<RecurringField, RecurringError>> = {};
  const name = input.name.trim();
  if (!name) errors.name = 'name_required';
  else if (name.length > NAME_MAX) errors.name = 'name_too_long';

  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0) {
    errors.amount = 'amount_required';
  } else if (input.amountMinor > AMOUNT_MAX) errors.amount = 'amount_too_large';

  const s = input.schedule;
  switch (s.periodicity) {
    case 'monthly':
      if (!Number.isInteger(s.anchorDay) || s.anchorDay < 1 || s.anchorDay > 31) {
        errors.schedule = 'day_invalid';
      }
      break;
    case 'daily':
    case 'weekly':
      if (!Number.isInteger(s.weekdaysMask) || s.weekdaysMask <= 0 || s.weekdaysMask > 127) {
        errors.schedule = 'weekdays_required';
      }
      break;
    case 'biweekly':
    case 'yearly':
      if (!validDate(s.anchorDate)) errors.schedule = 'date_invalid';
      break;
  }
  return errors;
}

export const isValidRecurring = (input: RecurringInput) =>
  Object.keys(validateRecurring(input)).length === 0;
