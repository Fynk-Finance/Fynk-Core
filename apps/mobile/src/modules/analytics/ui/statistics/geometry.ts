// Geometry and short labels of the Estadísticas summary card. Pure: the chart is drawn in a
// 100 × 100 box (as the design's viewBox) and stretched to the card.
import type { IsoDate, MoneyMinor } from '@shared/domain';

import type { CurvePoint } from '../../domain/statistics';

/** Room above the highest line, so the "Hoy" label and the dot fit (design: y 18 of 100). */
const TOP = 18;
const BOTTOM = 100;

export interface CurveGeometry {
  /** Solid line of this period. */
  current: string;
  /** Area under the solid line, closed at the bottom. */
  area: string;
  /** Dotted line of the previous period, on the same x positions. */
  previous: string;
  /** Last point of this period, in percent of the box. */
  end: { x: number; y: number };
}

function y(minor: MoneyMinor, max: MoneyMinor): number {
  return max <= 0 ? BOTTOM : BOTTOM - ((BOTTOM - TOP) * minor) / max;
}

function line(points: readonly CurvePoint[], count: number, max: MoneyMinor): string {
  const step = count > 1 ? 100 / (count - 1) : 0;
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${round(i * step)} ${round(y(p.cumulativeMinor, max))}`)
    .join(' ');
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Both lines on one scale: the highest of the two totals reaches the top room. */
export function curveGeometry(
  current: readonly CurvePoint[],
  previous: readonly CurvePoint[],
): CurveGeometry {
  const count = Math.max(current.length, previous.length, 1);
  const max = Math.max(current.at(-1)?.cumulativeMinor ?? 0, previous.at(-1)?.cumulativeMinor ?? 0);
  const solid = line(current, count, max);
  const lastX = count > 1 ? round(((current.length - 1) * 100) / (count - 1)) : 0;
  const endY = round(y(current.at(-1)?.cumulativeMinor ?? 0, max));
  return {
    current: solid,
    area: solid ? `${solid} L${lastX} ${BOTTOM} L0 ${BOTTOM} Z` : '',
    previous: line(previous, count, max),
    end: { x: lastX, y: endY },
  };
}

/** Five dates under the chart, evenly spread, the last one "Hoy" ("28 sep … 19 oct · Hoy"). */
export function axisLabels(
  points: readonly CurvePoint[],
  months: readonly string[],
  today: string,
): string[] {
  if (points.length === 0) return [];
  const last = points.length - 1;
  const marks = points.length >= 5 ? 5 : points.length;
  return Array.from({ length: marks }, (_, i) => {
    if (i === marks - 1) return today;
    const index = marks > 1 ? Math.floor((i * last) / (marks - 1)) : 0;
    return shortDate(points[index]!.date, months);
  });
}

/** "2026-09-28" → "28 sep". */
export function shortDate(date: IsoDate, months: readonly string[]): string {
  return `${Number(date.slice(8, 10))} ${months[Number(date.slice(5, 7)) - 1] ?? ''}`;
}

/** Bar labels of "Por día de la semana": "$82k", "$129k", or whole pesos under $1.000. */
export function shortCop(minor: MoneyMinor): string {
  const pesos = Math.floor(minor / 100);
  return pesos >= 1000 ? `$${Math.round(pesos / 1000)}k` : `$${pesos}`;
}

/** Whole percent change against the previous period, or 0 without one. */
export function changePercent(current: MoneyMinor, previous: MoneyMinor): number {
  return previous > 0 ? Math.round(((current - previous) * 100) / previous) : 0;
}
