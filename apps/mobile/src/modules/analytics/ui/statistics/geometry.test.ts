import { analyticsStrings } from '../strings.es-CO';
import { axisLabels, changePercent, curveGeometry, shortCop, shortDate } from './geometry';

const months = analyticsStrings.statistics.months;
const point = (date: string, cumulativeMinor: number) => ({ date, cumulativeMinor });

describe('Estadísticas chart geometry', () => {
  it('puts both periods on one scale, the highest total at the top room', () => {
    const g = curveGeometry(
      [point('2026-10-26', 0), point('2026-10-27', 5_000), point('2026-10-28', 10_000)],
      [point('2026-10-23', 0), point('2026-10-24', 10_000), point('2026-10-25', 20_000)],
    );
    expect(g.current).toBe('M0 100 L50 79.5 L100 59');
    expect(g.previous).toBe('M0 100 L50 59 L100 18');
    expect(g.area).toBe('M0 100 L50 79.5 L100 59 L100 100 L0 100 Z');
    expect(g.end).toEqual({ x: 100, y: 59 });
  });

  it('stays flat at the bottom without spending', () => {
    expect(curveGeometry([point('2026-10-28', 0)], []).current).toBe('M0 100');
  });

  it('labels five dates, the last one "Hoy"', () => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.UTC(2026, 8, 28 + i)).toISOString().slice(0, 10);
      return point(d, 0);
    });
    expect(axisLabels(days, months, 'Hoy')).toEqual(['28 sep', '5 oct', '12 oct', '19 oct', 'Hoy']);
    expect(axisLabels(days.slice(0, 3), months, 'Hoy')).toEqual(['28 sep', '29 sep', 'Hoy']);
    expect(shortDate('2026-10-01', months)).toBe('1 oct');
  });

  it('shortens the weekday bars and computes the change', () => {
    expect(shortCop(8_240_000)).toBe('$82k');
    expect(shortCop(12_860_000)).toBe('$129k');
    expect(shortCop(50_000)).toBe('$500');
    expect(changePercent(348_240_000, 378_520_000)).toBe(-8);
    expect(changePercent(10, 0)).toBe(0);
  });
});
