// The payday reminder of a goal (M8 prompt, from Recomendaciones "Programar"): an amount and
// the salary day, and a monthly reminder at 9:00 Bogotá time "Hoy es día de pago: aparta
// $300.000 para Viaje a Cartagena". It never moves money. Pure.
import type { IsoDateTime, MoneyMinor } from '@shared/domain/types';

export interface PaydayInput {
  amountMinor: MoneyMinor;
  /** Day of the month, 1 to 31. In a shorter month it falls on the last day. */
  day: number;
}

export type PaydayError = 'amount' | 'day';

export function validatePayday(input: PaydayInput): PaydayError[] {
  const errors: PaydayError[] = [];
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) errors.push('amount');
  if (!Number.isInteger(input.day) || input.day < 1 || input.day > 31) errors.push('day');
  return errors;
}

/** 9:00 in Bogotá (UTC-5 all year) is 14:00 UTC. */
const REMINDER_HOUR_UTC = 14;
const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;

const daysIn = (year: number, month0: number) =>
  new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

/**
 * The next payday at 9:00 Bogotá time, after `now`. The 31st in a 30 day month is the 30th, and
 * a payday whose 9:00 already passed today moves to next month.
 */
export function nextPaydayAt(day: number, now: Date): IsoDateTime {
  const bogota = new Date(now.getTime() + BOGOTA_OFFSET_MS);
  let year = bogota.getUTCFullYear();
  let month0 = bogota.getUTCMonth();
  for (let i = 0; i < 2; i++) {
    const at = Date.UTC(year, month0, Math.min(day, daysIn(year, month0)), REMINDER_HOUR_UTC);
    if (at > now.getTime()) return new Date(at).toISOString();
    month0 += 1;
    if (month0 === 12) {
      month0 = 0;
      year += 1;
    }
  }
  /* istanbul ignore next: two months always contain a future payday */
  throw new Error('No payday found');
}

/** The salary day M10 found (its usual day), or null. */
export function salaryDay(
  sources: readonly {
    kind: 'salary' | 'other';
    usualDay: number;
    estimatedMonthlyMinor: MoneyMinor;
  }[],
): number | null {
  const salaries = sources
    .filter((s) => s.kind === 'salary' && s.usualDay >= 1 && s.usualDay <= 31)
    .sort((a, b) => b.estimatedMonthlyMinor - a.estimatedMonthlyMinor);
  return salaries[0]?.usualDay ?? null;
}
