// Calendar helpers in America/Bogota. Colombia has no daylight saving time, so Bogotá is always
// UTC-05:00 and the conversion is a fixed offset. Pure functions, no Date.now().
import type { IsoDate, IsoDateTime } from '@shared/domain';

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM`, the key of a calendar month. */
export type MonthKey = string;

function parseIsoDate(date: IsoDate): number {
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(ms) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new RangeError(`Invalid ISO date: ${date}`);
  }
  return ms;
}

function formatIsoDate(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** The Bogotá calendar day of an instant. `2026-10-01T03:00:00Z` → `2026-09-30`. */
export function bogotaDate(at: IsoDateTime | Date): IsoDate {
  const ms = typeof at === 'string' ? Date.parse(at) : at.getTime();
  if (Number.isNaN(ms)) throw new RangeError(`Invalid date time: ${String(at)}`);
  return formatIsoDate(ms + BOGOTA_OFFSET_MS);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return formatIsoDate(parseIsoDate(date) + days * DAY_MS);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((parseIsoDate(to) - parseIsoDate(from)) / DAY_MS);
}

export function monthOf(date: IsoDate): MonthKey {
  parseIsoDate(date);
  return date.slice(0, 7);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const [y = 0, m = 1] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  const year = Math.floor(index / 12);
  const mm = (index % 12) + 1;
  return `${String(year).padStart(4, '0')}-${String(mm).padStart(2, '0')}`;
}

export function firstDayOfMonth(month: MonthKey): IsoDate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: MonthKey): IsoDate {
  return addDays(firstDayOfMonth(addMonths(month, 1)), -1);
}

/** Day of month, 1 to 31. */
export function dayOfMonth(date: IsoDate): number {
  return Number(date.slice(8, 10));
}

/** Monday of the week of `date` (weeks run Monday to Sunday). */
export function weekStart(date: IsoDate): IsoDate {
  const weekday = new Date(parseIsoDate(date)).getUTCDay(); // 0 Sunday … 6 Saturday
  const sinceMonday = (weekday + 6) % 7;
  return addDays(date, -sinceMonday);
}

/** Inclusive date range. */
export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export function inRange(date: IsoDate, range: DateRange): boolean {
  return date >= range.from && date <= range.to;
}

/** The last `days` days ending on `today`, both included. */
export function lastDays(today: IsoDate, days: number): DateRange {
  return { from: addDays(today, -(days - 1)), to: today };
}
