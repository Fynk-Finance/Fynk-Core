// Recurring items of M9: fixed expenses and subscriptions (glossary: gasto fijo, suscripción).
import type { Id, IsoDate, MoneyMinor } from '@shared/domain/types';

export type RecurringKind = 'fixed' | 'subscription';

export type Periodicity = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

/** Bit per weekday, Sunday first: Sunday = 1, Monday = 2, ... Saturday = 64. */
export type WeekdaysMask = number;

export const WEEKDAY = {
  sun: 1,
  mon: 2,
  tue: 4,
  wed: 8,
  thu: 16,
  fri: 32,
  sat: 64,
} as const;

/** "Lun a vie", the default of a daily item. */
export const MON_TO_FRI: WeekdaysMask =
  WEEKDAY.mon | WEEKDAY.tue | WEEKDAY.wed | WEEKDAY.thu | WEEKDAY.fri;

/**
 * When an item is charged.
 * - daily: every day whose weekday is in `weekdaysMask` ("Lun a vie").
 * - weekly: every week on the weekdays of `weekdaysMask` ("Cada lunes").
 * - biweekly: every 14 days from `anchorDate`.
 * - monthly: on `anchorDay` of every month, moved to the last day in shorter months ("Día 1").
 * - yearly: every year on the month and day of `anchorDate`.
 */
export type Schedule =
  | { periodicity: 'daily' | 'weekly'; weekdaysMask: WeekdaysMask }
  | { periodicity: 'biweekly' | 'yearly'; anchorDate: IsoDate }
  | { periodicity: 'monthly'; anchorDay: number };

export type Usage = 'high' | 'some' | 'low';

export interface RecurringItem {
  id: Id;
  kind: RecurringKind;
  name: string;
  /** Amount of one charge. */
  amountMinor: MoneyMinor;
  schedule: Schedule;
  status: 'active' | 'cancelled';
  /** The person's own mark ("¿Cuánto la usas?"). Only for subscriptions. */
  usage: Usage | null;
}

/** A calendar month: year and month 1 to 12. */
export interface YearMonth {
  year: number;
  month: number;
}
