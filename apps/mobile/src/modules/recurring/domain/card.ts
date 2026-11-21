// What each recurring card of Billetera shows (design Billetera, "Gastos recurrentes"): the
// periodicity badge, when it is charged ("Día 1", "Cada lunes", "Lun a vie") and the state of
// its next charge ("Pagado", "Hoy", "En 2 días", "Lun 29"). Pure: today is a Bogotá date.
import type { IsoDate } from '@shared/domain/types';

import { nextCharge } from './schedule';
import { MON_TO_FRI, type Periodicity, type Schedule } from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAY_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ALL_DAYS = 127;

export const PERIODICITY_LABEL: Record<Periodicity, string> = {
  daily: 'Diario',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
};

const day = (date: IsoDate) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const weekdayOf = (date: IsoDate) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Weekdays of a mask, Monday first. */
function daysOf(mask: number): number[] {
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => (mask & (1 << d)) !== 0);
}

/** "Día 1", "Cada lunes", "Lun a vie", "Lun y jue", "Cada 2 semanas", "Cada año · 15 mar". */
export function scheduleLabel(s: Schedule): string {
  switch (s.periodicity) {
    case 'monthly':
      return `Día ${s.anchorDay}`;
    case 'daily':
    case 'weekly': {
      if (s.weekdaysMask === MON_TO_FRI) return 'Lun a vie';
      if (s.weekdaysMask === ALL_DAYS) return 'Todos los días';
      const days = daysOf(s.weekdaysMask);
      if (days.length === 1) return `Cada ${WEEKDAY_LONG[days[0]!]}`;
      const names = days.map((d) => WEEKDAY_SHORT[d]);
      return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
    }
    case 'biweekly':
      return 'Cada 2 semanas';
    case 'yearly': {
      const [, m, d] = s.anchorDate.split('-').map(Number) as [number, number, number];
      return `Cada año · ${d} ${MONTHS[m - 1]}`;
    }
  }
}

export type ChargeState =
  | { kind: 'today' }
  | { kind: 'soon'; days: 1 | 2 }
  | { kind: 'paid' }
  | { kind: 'upcoming'; date: IsoDate }
  | { kind: 'none' };

/**
 * "Hoy" when it is charged today, "En 2 días" within two days, "Pagado" when this month's
 * charge of a monthly item already passed, otherwise the date of the next charge.
 */
export function chargeState(s: Schedule, today: IsoDate): ChargeState {
  const next = nextCharge(s, today);
  if (!next) return { kind: 'none' };
  const days = day(next) - day(today);
  if (days === 0) return { kind: 'today' };
  if (days === 1 || days === 2) return { kind: 'soon', days };
  if (s.periodicity === 'monthly' && next.slice(0, 7) !== today.slice(0, 7))
    return { kind: 'paid' };
  return { kind: 'upcoming', date: next };
}

/** "28 sep": day and short month of a date, as in "renueva 28 sep". */
export function dayMonth(date: IsoDate): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}

/** The badge text of a ChargeState: "Hoy", "Mañana", "En 2 días", "Pagado", "Lun 29". */
export function chargeLabel(state: ChargeState): string {
  switch (state.kind) {
    case 'today':
      return 'Hoy';
    case 'soon':
      return state.days === 1 ? 'Mañana' : 'En 2 días';
    case 'paid':
      return 'Pagado';
    case 'upcoming':
      return `${WEEKDAY_SHORT[weekdayOf(state.date)]} ${Number(state.date.slice(8, 10))}`;
    case 'none':
      return '';
  }
}
