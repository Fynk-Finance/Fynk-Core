// Relative times for Seguridad ("hace 3 meses"). Pure: the caller passes the current time.
import type { IsoDateTime } from '@shared/domain/types';

/** Returned for anything under 2 minutes, and for a time slightly in the future (clock skew). */
export const JUST_NOW = 'ahora';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const plural = (n: number, one: string, many: string) => `hace ${n} ${n === 1 ? one : many}`;

/**
 * "ahora" under 2 minutes, otherwise "hace 5 minutos", "hace 1 día", "hace 3 semanas",
 * "hace 1 mes", "hace 2 años". Months are 30 days and years 365. '' when `iso` is not a date.
 */
export function relativeTime(iso: IsoDateTime, now: Date): string {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '';
  const elapsed = now.getTime() - time;
  if (elapsed < 2 * MINUTE) return JUST_NOW;
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), 'minuto', 'minutos');
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), 'hora', 'horas');
  const days = Math.floor(elapsed / DAY);
  if (days < 7) return plural(days, 'día', 'días');
  if (days < 30) return plural(Math.floor(days / 7), 'semana', 'semanas');
  if (days < 365) return plural(Math.floor(days / 30), 'mes', 'meses');
  return plural(Math.floor(days / 365), 'año', 'años');
}
