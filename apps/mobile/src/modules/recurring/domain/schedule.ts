// Calendar rules of a recurring item: how many charges fall in a month, and the next charge.
// Pure: dates are calendar days ('2026-10-28'), with no time zone. The caller passes today in
// Bogotá.
import type { IsoDate } from '@shared/domain/types';

import type { Schedule, WeekdaysMask, YearMonth } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Days since 1970-01-01. */
function toDay(date: IsoDate): number {
  const m = ISO_DATE.exec(date);
  if (!m) throw new RangeError(`Not a calendar date: ${date}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS;
}

function fromDay(day: number): IsoDate {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

function dayOf(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

export function daysInMonth({ year, month }: YearMonth): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Sunday = 0 ... Saturday = 6, as the bits of WeekdaysMask. */
function weekday(day: number): number {
  return new Date(day * DAY_MS).getUTCDay();
}

const inMask = (mask: WeekdaysMask, day: number) => (mask & (1 << weekday(day))) !== 0;

/** The charge day of a monthly item in a given month: the 31st becomes the 30th in a 30 day month. */
function monthlyDay(anchorDay: number, ym: YearMonth): number {
  return dayOf(ym.year, ym.month, Math.min(anchorDay, daysInMonth(ym)));
}

function parts(date: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return { year, month, day };
}

/**
 * How many charges fall inside the calendar month. Weekly on Mondays in a month with 4 Mondays
 * gives 4, daily Monday to Friday in a month with 22 weekdays gives 22, monthly gives 1.
 */
export function occurrencesInMonth(schedule: Schedule, ym: YearMonth): number {
  const first = dayOf(ym.year, ym.month, 1);
  const last = first + daysInMonth(ym) - 1;
  switch (schedule.periodicity) {
    case 'daily':
    case 'weekly': {
      let count = 0;
      for (let d = first; d <= last; d++) if (inMask(schedule.weekdaysMask, d)) count += 1;
      return count;
    }
    case 'monthly':
      return 1;
    case 'yearly':
      return parts(schedule.anchorDate).month === ym.month ? 1 : 0;
    case 'biweekly': {
      const anchor = toDay(schedule.anchorDate);
      let count = 0;
      for (let d = Math.max(first, anchor); d <= last; d++) if ((d - anchor) % 14 === 0) count += 1;
      return count;
    }
  }
}

/** The first charge on or after `from`. Null when a daily or weekly item has no weekday set. */
export function nextCharge(schedule: Schedule, from: IsoDate): IsoDate | null {
  const start = toDay(from);
  const { year, month } = parts(from);
  switch (schedule.periodicity) {
    case 'daily':
    case 'weekly': {
      for (let d = start; d < start + 7; d++)
        if (inMask(schedule.weekdaysMask, d)) return fromDay(d);
      return null;
    }
    case 'monthly': {
      const thisMonth = monthlyDay(schedule.anchorDay, { year, month });
      if (thisMonth >= start) return fromDay(thisMonth);
      const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
      return fromDay(monthlyDay(schedule.anchorDay, next));
    }
    case 'biweekly': {
      const anchor = toDay(schedule.anchorDate);
      const periods = Math.max(0, Math.ceil((start - anchor) / 14));
      return fromDay(anchor + periods * 14);
    }
    case 'yearly': {
      const a = parts(schedule.anchorDate);
      const on = (y: number) => monthlyDay(a.day, { year: y, month: a.month });
      return fromDay(on(year) >= start ? on(year) : on(year + 1));
    }
  }
}
