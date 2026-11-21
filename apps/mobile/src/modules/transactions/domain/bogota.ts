// Bogotá days and their UTC bounds. Colombia has no daylight saving time, so a Bogotá day
// always starts at 05:00 UTC. Pure functions: callers pass the dates.
import type { IsoDate, IsoDateTime } from '@shared/domain/types';

const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidDateError extends RangeError {
  constructor(value: string) {
    super(`Invalid date: ${value}`);
    this.name = 'InvalidDateError';
  }
}

/** Parses '2026-10-25' as midnight UTC of that calendar day. Throws on anything else. */
function parseDay(day: IsoDate): number {
  const ms = ISO_DATE.test(day) ? Date.parse(`${day}T00:00:00Z`) : Number.NaN;
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== day) {
    throw new InvalidDateError(day);
  }
  return ms;
}

/** The Bogotá calendar day of an instant. */
export function bogotaDay(at: Date | IsoDateTime): IsoDate {
  const ms = typeof at === 'string' ? Date.parse(at) : at.getTime();
  if (Number.isNaN(ms)) throw new InvalidDateError(String(at));
  return new Date(ms + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** The first instant of a Bogotá day, in UTC: '2026-10-25' gives '2026-10-25T05:00:00.000Z'. */
export function bogotaDayStart(day: IsoDate): IsoDateTime {
  return new Date(parseDay(day) - BOGOTA_OFFSET_MS).toISOString();
}

/** UTC bounds of Bogotá days `from` to `to`, both included: [start, end). */
export function bogotaRange(from: IsoDate, to: IsoDate): { start: IsoDateTime; end: IsoDateTime } {
  const start = parseDay(from) - BOGOTA_OFFSET_MS;
  const end = parseDay(to) - BOGOTA_OFFSET_MS + DAY_MS;
  if (end <= start) throw new RangeError(`The range ends before it starts: ${from} to ${to}`);
  return { start: new Date(start).toISOString(), end: new Date(end).toISOString() };
}

/** Adds whole days to a calendar day. */
export function addDays(day: IsoDate, days: number): IsoDate {
  return new Date(parseDay(day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** The stored form of an instant: UTC with milliseconds, so text order is time order. */
export function canonicalInstant(at: IsoDateTime): IsoDateTime {
  const ms = Date.parse(at);
  if (Number.isNaN(ms)) throw new InvalidDateError(at);
  return new Date(ms).toISOString();
}
