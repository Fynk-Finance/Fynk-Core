// Numbers of the Estadísticas screen (design screen 14): the spending curve of a period against
// the previous one, the summary stats, the spending by day of the week and the places where the
// person spends the most. Pure functions over the vault movements, in integer centavos and
// Bogotá days. Merchant names stay on the phone: none of this goes in the AI snapshot.
import type { CategoryId, IsoDate, MoneyMinor, Transaction } from '@shared/domain';

import { addDays, daysBetween, inRange, lastDays, type DateRange } from './dates';
import { dailyAverageMinor, incomeIn, isSpending, spendingIn, txDate } from './spending';

/** The period control of Estadísticas: "3 días", "Semana", "Mes", "Año". */
export type StatsPeriod = '3d' | 'week' | 'month' | 'year';

/** Days of each period. "Mes" is the last 30 days, as in "Gastaste en los últimos 30 días". */
export const STATS_PERIOD_DAYS: Readonly<Record<StatsPeriod, number>> = {
  '3d': 3,
  week: 7,
  month: 30,
  year: 365,
};

export interface CurvePoint {
  date: IsoDate;
  /** Spending from the first day of the period to this day, both included. */
  cumulativeMinor: MoneyMinor;
}

export interface PeriodSummary {
  period: StatsPeriod;
  range: DateRange;
  /** The same number of days right before `range`. */
  previousRange: DateRange;
  spendingMinor: MoneyMinor;
  previousSpendingMinor: MoneyMinor;
  incomeMinor: MoneyMinor;
  /** Income minus spending of the period ("Balance +$2.097.600"). */
  balanceMinor: MoneyMinor;
  /** Spent today ("Hoy $129.890"). */
  todayMinor: MoneyMinor;
  /** One point per day of the period, oldest first ("Este periodo"). */
  current: CurvePoint[];
  /** One point per day of the previous period, aligned by day index ("Periodo anterior"). */
  previous: CurvePoint[];
}

/** The range of `period` ending today, and the one right before it. */
export function periodRanges(
  period: StatsPeriod,
  today: IsoDate,
): { range: DateRange; previousRange: DateRange } {
  const days = STATS_PERIOD_DAYS[period];
  const range = lastDays(today, days);
  return { range, previousRange: lastDays(addDays(range.from, -1), days) };
}

/** Spending per Bogotá day, for the days that have any. */
function spendingByDay(txs: readonly Transaction[], range: DateRange): Map<IsoDate, MoneyMinor> {
  const byDay = new Map<IsoDate, MoneyMinor>();
  for (const tx of txs) {
    if (!isSpending(tx)) continue;
    const day = txDate(tx);
    if (inRange(day, range)) byDay.set(day, (byDay.get(day) ?? 0) - tx.amountMinor);
  }
  return byDay;
}

function curve(txs: readonly Transaction[], range: DateRange): CurvePoint[] {
  const byDay = spendingByDay(txs, range);
  const points: CurvePoint[] = [];
  let total = 0;
  for (let i = 0; i <= daysBetween(range.from, range.to); i += 1) {
    const date = addDays(range.from, i);
    total += byDay.get(date) ?? 0;
    points.push({ date, cumulativeMinor: total });
  }
  return points;
}

/** The summary card of Estadísticas for a period ending today. */
export function periodSummary(
  txs: readonly Transaction[],
  period: StatsPeriod,
  today: IsoDate,
): PeriodSummary {
  const { range, previousRange } = periodRanges(period, today);
  const spendingMinor = spendingIn(txs, range);
  const incomeMinor = incomeIn(txs, range);
  return {
    period,
    range,
    previousRange,
    spendingMinor,
    previousSpendingMinor: spendingIn(txs, previousRange),
    incomeMinor,
    balanceMinor: incomeMinor - spendingMinor,
    todayMinor: spendingIn(txs, { from: today, to: today }),
    current: curve(txs, range),
    previous: curve(txs, previousRange),
  };
}

export interface HighestExpense {
  amountMinor: MoneyMinor;
  /** What the movement says ("Arriendo"). Stays on the phone. */
  label: string;
  date: IsoDate;
  categoryId: CategoryId;
}

export interface PeriodStats {
  /** "Promedio diario": spending of the period over its days, rounded down. */
  dailyAverageMinor: MoneyMinor;
  /** "Gasto más alto": the biggest single spending, the latest one on a tie. */
  highest: HighestExpense | null;
  /** "Movimientos": every movement booked in the period, money in and out. */
  movementCount: number;
  /** "12 más que el mes anterior": this count minus the count of the previous period. */
  movementDelta: number;
  /** "Ahorraste": what was spent less than in the previous period (negative: spent more). */
  savedVsPreviousMinor: MoneyMinor;
}

function labelOf(tx: Transaction): string {
  return (tx.merchantRaw ?? tx.description).trim() || tx.description;
}

/** "Tus estadísticas" for a range against the range before it. */
export function periodStats(
  txs: readonly Transaction[],
  range: DateRange,
  previousRange: DateRange,
): PeriodStats {
  let highest: HighestExpense | null = null;
  let movementCount = 0;
  let previousCount = 0;
  for (const tx of txs) {
    const day = txDate(tx);
    if (inRange(day, previousRange)) previousCount += 1;
    if (!inRange(day, range)) continue;
    movementCount += 1;
    if (!isSpending(tx)) continue;
    const amountMinor = -tx.amountMinor;
    if (
      !highest ||
      amountMinor > highest.amountMinor ||
      (amountMinor === highest.amountMinor && day > highest.date)
    ) {
      highest = { amountMinor, label: labelOf(tx), date: day, categoryId: tx.categoryId };
    }
  }
  const spending = spendingIn(txs, range);
  return {
    dailyAverageMinor: dailyAverageMinor(spending, daysBetween(range.from, range.to) + 1),
    highest,
    movementCount,
    movementDelta: movementCount - previousCount,
    savedVsPreviousMinor: spendingIn(txs, previousRange) - spending,
  };
}

/** Monday 0 to Sunday 6, as the bars of "Por día de la semana" (Lun … Dom). */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function weekdayOf(date: IsoDate): Weekday {
  return ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) as Weekday;
}

export interface WeekdayPattern {
  /** Average spending of each weekday in the range, Monday first, rounded down. */
  averagesMinor: MoneyMinor[];
  /** The "Promedio" line: spending of the range over its days, rounded down. */
  averageMinor: MoneyMinor;
  /**
   * The weekday with the highest average, compared with Monday to Friday when it is a weekend
   * day, or with the other days when it is a weekday. Null without spending.
   */
  peak: { weekday: Weekday; againstWeekdays: boolean; timesPercent: number } | null;
}

/** "Por día de la semana": the average spending of each day of the week in the range. */
export function weekdayPattern(txs: readonly Transaction[], range: DateRange): WeekdayPattern {
  const totals = [0, 0, 0, 0, 0, 0, 0];
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const days = daysBetween(range.from, range.to) + 1;
  for (let i = 0; i < days; i += 1) counts[weekdayOf(addDays(range.from, i))]! += 1;
  for (const [day, minor] of spendingByDay(txs, range)) totals[weekdayOf(day)]! += minor;

  const averagesMinor = totals.map((t, i) => dailyAverageMinor(t, counts[i]!));
  const total = totals.reduce((a, b) => a + b, 0);
  if (total === 0) return { averagesMinor, averageMinor: 0, peak: null };

  let weekday = 0 as Weekday;
  averagesMinor.forEach((avg, i) => {
    if (avg > averagesMinor[weekday]!) weekday = i as Weekday;
  });
  const againstWeekdays = weekday >= 5;
  const others = averagesMinor.filter((_, i) => (againstWeekdays ? i < 5 : i !== weekday));
  const othersAverage = others.reduce((a, b) => a + b, 0) / others.length;
  const timesPercent =
    othersAverage > 0 ? Math.round((averagesMinor[weekday]! * 100) / othersAverage) : 0;
  return {
    averagesMinor,
    averageMinor: dailyAverageMinor(total, days),
    peak: { weekday, againstWeekdays, timesPercent },
  };
}

export interface TopPlace {
  /** The normalized merchant, or the description when the movement has none. */
  key: string;
  /** What the latest movement says ("Supermercado"). Stays on the phone. */
  label: string;
  /** The category of the latest movement ("Comida"). */
  categoryId: CategoryId;
  count: number;
  totalMinor: MoneyMinor;
}

/**
 * Fixed bills (rent, utilities, internet and phone, subscriptions) are not "places where you
 * spend": Billetera already shows them, and the design lists only day to day places.
 */
export const FIXED_BILL_CATEGORIES: readonly CategoryId[] = [
  'rent',
  'utilities',
  'telecom',
  'subscriptions',
];

/** "Dónde más gastas": the day to day places with the most spending in the range. */
export function topPlaces(txs: readonly Transaction[], range: DateRange, limit = 3): TopPlace[] {
  const places = new Map<string, TopPlace & { last: string }>();
  for (const tx of txs) {
    if (!isSpending(tx) || FIXED_BILL_CATEGORIES.includes(tx.categoryId)) continue;
    if (!inRange(txDate(tx), range)) continue;
    const key = tx.merchantKey ?? tx.description.trim().toLowerCase();
    const place = places.get(key);
    if (!place) {
      places.set(key, {
        key,
        label: labelOf(tx),
        categoryId: tx.categoryId,
        count: 1,
        totalMinor: -tx.amountMinor,
        last: tx.bookedAt,
      });
      continue;
    }
    place.count += 1;
    place.totalMinor -= tx.amountMinor;
    if (tx.bookedAt > place.last) {
      place.last = tx.bookedAt;
      place.label = labelOf(tx);
      place.categoryId = tx.categoryId;
    }
  }
  return [...places.values()]
    .sort((a, b) => b.totalMinor - a.totalMinor || a.key.localeCompare(b.key))
    .slice(0, limit)
    .map(({ last: _last, ...place }) => place);
}
