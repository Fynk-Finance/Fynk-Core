// What the "Registrar movimiento" sheet holds while the person types, and the input it turns
// into on "Guardar". Pure: the caller passes now.
import { formatCop, parseCopInput } from '@shared/domain/money';
import type { CategoryId, Id, Transaction } from '@shared/domain/types';

import { addDays, bogotaDay, bogotaDayStart } from './bogota';
import { formatDayInput, parseDayInput } from './filter';
import type { ManualInput } from './manual';

export type DayChoice = 'today' | 'yesterday' | 'other';

export interface ManualDraft {
  kind: 'expense' | 'income';
  amountText: string;
  accountId: Id | null;
  day: DayChoice;
  dayText: string;
  description: string;
  /** Null: "Automática", the pipeline picks it. */
  categoryId: CategoryId | null;
}

export type ManualDraftError = 'amount' | 'account' | 'day' | 'description';

/** A movement on another day is placed at noon in Bogotá. */
const NOON_MS = 12 * 60 * 60 * 1000;

export function emptyManualDraft(accountId: Id | null): ManualDraft {
  return {
    kind: 'expense',
    amountText: '',
    accountId,
    day: 'today',
    dayText: '',
    description: '',
    categoryId: null,
  };
}

/** The sheet filled with a manual movement, to edit it. */
export function manualDraftFrom(tx: Transaction, now: Date): ManualDraft {
  const day = bogotaDay(tx.bookedAt);
  const today = bogotaDay(now);
  return {
    kind: tx.amountMinor > 0 ? 'income' : 'expense',
    amountText: formatCop(Math.abs(tx.amountMinor)).replace('$', ''),
    accountId: tx.accountId,
    day: day === today ? 'today' : day === addDays(today, -1) ? 'yesterday' : 'other',
    dayText: formatDayInput(day),
    description: tx.description,
    categoryId: tx.categorySource === 'user' ? tx.categoryId : null,
  };
}

export function manualDraftToInput(
  draft: ManualDraft,
  now: Date,
  /** When editing, the instant it had: kept when its day does not change. */
  previous?: string,
): { input: ManualInput; errors: [] } | { input: null; errors: ManualDraftError[] } {
  const errors: ManualDraftError[] = [];
  const amount = parseCopInput(draft.amountText);
  if (amount === null || amount <= 0) errors.push('amount');
  if (!draft.accountId) errors.push('account');
  if (!draft.description.trim()) errors.push('description');

  const today = bogotaDay(now);
  let bookedAt: string | null = null;
  const day =
    draft.day === 'today'
      ? today
      : draft.day === 'yesterday'
        ? addDays(today, -1)
        : parseDayInput(draft.dayText);
  if (!day || day > today) {
    errors.push('day');
  } else if (previous && bogotaDay(previous) === day) {
    bookedAt = previous;
  } else if (day === today) {
    bookedAt = now.toISOString();
  } else {
    bookedAt = new Date(Date.parse(bogotaDayStart(day)) + NOON_MS).toISOString();
  }

  if (errors.length > 0 || amount === null || !draft.accountId || !bookedAt) {
    return { input: null, errors };
  }
  return {
    input: {
      accountId: draft.accountId,
      kind: draft.kind,
      amountMinor: amount,
      bookedAt,
      description: draft.description.trim(),
      ...(draft.categoryId ? { categoryId: draft.categoryId } : {}),
    },
    errors: [],
  };
}
