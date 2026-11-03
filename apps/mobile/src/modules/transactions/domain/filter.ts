// Filters of Movimientos (HU-016): date presets, checks before a filter is applied, how many
// filters are on (the badge on "Filtros"), and the filter other screens open the list with.
import { isCategoryId } from '@shared/domain/categories';
import type { IsoDate } from '@shared/domain/types';

import { addDays, bogotaDay } from './bogota';
import type { TransactionFilter } from './query';

export type DatePreset = 'this_month' | 'last_month' | 'last_3_months';
export const DATE_PRESETS: readonly DatePreset[] = ['this_month', 'last_month', 'last_3_months'];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function monthStart(day: IsoDate): IsoDate {
  return `${day.slice(0, 7)}-01`;
}

function shiftMonths(day: IsoDate, months: number): IsoDate {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/**
 * Bogotá days of a preset, both included:
 * "Este mes" from the 1st to today, "Mes anterior" the whole previous month, and
 * "Últimos 3 meses" the 3 months that end today.
 */
export function presetRange(preset: DatePreset, now: Date): { from: IsoDate; to: IsoDate } {
  const today = bogotaDay(now);
  switch (preset) {
    case 'this_month':
      return { from: monthStart(today), to: today };
    case 'last_month': {
      const start = shiftMonths(monthStart(today), -1);
      return { from: start, to: addDays(monthStart(today), -1) };
    }
    case 'last_3_months':
      return { from: addDays(shiftMonths(today, -3), 1), to: today };
  }
}

/** The preset a date range matches, or null for a custom range. */
export function presetOf(filter: TransactionFilter, now: Date): DatePreset | null {
  for (const preset of DATE_PRESETS) {
    const range = presetRange(preset, now);
    if (filter.from === range.from && filter.to === range.to) return preset;
  }
  return null;
}

export type FilterProblem = 'dates' | 'amounts';

/** What stops a filter from being applied: a range that ends before it starts, or bad amounts. */
export function filterProblems(filter: TransactionFilter): FilterProblem[] {
  const problems: FilterProblem[] = [];
  const badDay = (d: string | undefined) => d !== undefined && !ISO_DATE.test(d);
  if (
    badDay(filter.from) ||
    badDay(filter.to) ||
    (filter.from && filter.to && filter.from > filter.to)
  ) {
    problems.push('dates');
  }
  const badAmount = (a: number | undefined) =>
    a !== undefined && (!Number.isSafeInteger(a) || a < 0);
  if (
    badAmount(filter.minAmountMinor) ||
    badAmount(filter.maxAmountMinor) ||
    (filter.minAmountMinor !== undefined &&
      filter.maxAmountMinor !== undefined &&
      filter.minAmountMinor > filter.maxAmountMinor)
  ) {
    problems.push('amounts');
  }
  return problems;
}

/** Filters that are on: dates, amounts, kind, accounts and categories count one each. */
export function activeFilterCount(filter: TransactionFilter): number {
  return [
    filter.from !== undefined || filter.to !== undefined,
    filter.minAmountMinor !== undefined || filter.maxAmountMinor !== undefined,
    filter.kind !== undefined,
    (filter.accountIds?.length ?? 0) > 0,
    (filter.categoryIds?.length ?? 0) > 0,
  ].filter(Boolean).length;
}

/**
 * The filter a screen opens Movimientos with: { categoryId, from, to } from Estadísticas (M10),
 * { accountId } from Detalle de cuenta. Anything malformed is ignored.
 */
export function filterFromParams(params: unknown): TransactionFilter {
  if (typeof params !== 'object' || params === null) return {};
  const p = params as Record<string, unknown>;
  const filter: TransactionFilter = {};
  if (typeof p.from === 'string' && ISO_DATE.test(p.from)) filter.from = p.from;
  if (typeof p.to === 'string' && ISO_DATE.test(p.to)) filter.to = p.to;
  if (filter.from && filter.to && filter.from > filter.to) {
    delete filter.from;
    delete filter.to;
  }
  if (typeof p.categoryId === 'string' && isCategoryId(p.categoryId)) {
    filter.categoryIds = [p.categoryId];
  }
  if (typeof p.accountId === 'string' && p.accountId !== '') filter.accountIds = [p.accountId];
  return filter;
}

/** '22/09/2026' (or '22-09-2026', '2/9/2026') to '2026-09-22'. Null when it is not a real day. */
export function parseDayInput(text: string): IsoDate | null {
  const match = /^\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s*$/.exec(text);
  if (!match) return null;
  const [, d, m, y] = match as unknown as [string, string, string, string];
  const iso = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === iso ? iso : null;
}

/** '2026-09-22' to '22/09/2026', the way the person types it. */
export function formatDayInput(day: IsoDate): string {
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}
