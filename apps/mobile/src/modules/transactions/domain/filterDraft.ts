// What the Filtros sheet holds while the person edits it (texts as typed), and the filter it
// turns into on "Aplicar". Pure: the caller passes now.
import { formatCop, parseCopInput } from '@shared/domain/money';
import type { CategoryId, Id } from '@shared/domain/types';

import {
  filterProblems,
  formatDayInput,
  parseDayInput,
  presetOf,
  presetRange,
  type DatePreset,
} from './filter';
import type { TransactionFilter } from './query';

export type DateChoice = 'any' | DatePreset | 'custom';
export type KindChoice = 'all' | 'income' | 'expense';

export interface FilterDraft {
  kind: KindChoice;
  dates: DateChoice;
  fromText: string;
  toText: string;
  minText: string;
  maxText: string;
  accountIds: Id[];
  categoryIds: CategoryId[];
}

export type DraftError = 'from' | 'to' | 'dates' | 'min' | 'max' | 'amounts';

export const EMPTY_DRAFT: FilterDraft = {
  kind: 'all',
  dates: 'any',
  fromText: '',
  toText: '',
  minText: '',
  maxText: '',
  accountIds: [],
  categoryIds: [],
};

/** "$20.000" typed without its "$", because the field shows the prefix. */
const amountText = (minor: number | undefined) =>
  minor === undefined ? '' : formatCop(minor).replace('$', '');

export function draftFrom(filter: TransactionFilter, now: Date): FilterDraft {
  const hasDates = filter.from !== undefined || filter.to !== undefined;
  return {
    kind: filter.kind ?? 'all',
    dates: hasDates ? (presetOf(filter, now) ?? 'custom') : 'any',
    fromText: filter.from ? formatDayInput(filter.from) : '',
    toText: filter.to ? formatDayInput(filter.to) : '',
    minText: amountText(filter.minAmountMinor),
    maxText: amountText(filter.maxAmountMinor),
    accountIds: [...(filter.accountIds ?? [])],
    categoryIds: [...(filter.categoryIds ?? [])],
  };
}

export function draftToFilter(
  draft: FilterDraft,
  now: Date,
): { filter: TransactionFilter; errors: [] } | { filter: null; errors: DraftError[] } {
  const errors: DraftError[] = [];
  const filter: TransactionFilter = {};
  if (draft.kind !== 'all') filter.kind = draft.kind;

  if (draft.dates === 'custom') {
    const from = draft.fromText.trim() ? parseDayInput(draft.fromText) : undefined;
    const to = draft.toText.trim() ? parseDayInput(draft.toText) : undefined;
    if (from === null) errors.push('from');
    else if (from) filter.from = from;
    if (to === null) errors.push('to');
    else if (to) filter.to = to;
  } else if (draft.dates !== 'any') {
    Object.assign(filter, presetRange(draft.dates, now));
  }

  const amount = (text: string, error: DraftError) => {
    if (!text.trim()) return undefined;
    const minor = parseCopInput(text);
    if (minor === null || minor < 0) {
      errors.push(error);
      return undefined;
    }
    return minor;
  };
  const min = amount(draft.minText, 'min');
  const max = amount(draft.maxText, 'max');
  if (min !== undefined) filter.minAmountMinor = min;
  if (max !== undefined) filter.maxAmountMinor = max;

  if (draft.accountIds.length > 0) filter.accountIds = [...draft.accountIds];
  if (draft.categoryIds.length > 0) filter.categoryIds = [...draft.categoryIds];

  errors.push(...filterProblems(filter));
  return errors.length > 0 ? { filter: null, errors } : { filter, errors: [] };
}

/** Adds the value when it is missing, removes it when it is there. */
export function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
