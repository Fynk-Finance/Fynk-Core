// Estadísticas (design screen 14) on a fixture built from the design's own numbers
// (shared contracts, section 7): $3.482.400 in the last 30 days, $116.080 a day,
// Balance +$2.097.600, Arriendo $1.400.000 on 1 oct, 64 movements (12 more), $302.800 saved,
// and Supermercado, Recargas de transporte and Restaurantes as the top places.
import type { Transaction } from '@shared/domain';

import { cop, tx } from '../testing/txFactory';
import {
  periodRanges,
  periodStats,
  periodSummary,
  topPlaces,
  weekdayOf,
  weekdayPattern,
} from './statistics';

const TODAY = '2026-10-27';

function designMonth(): Transaction[] {
  const txs: Transaction[] = [
    tx('2026-10-15', 5_580_000, 'salary', { merchant: 'NOMINA EMPRESA' }),
    tx('2026-10-01', -1_400_000, 'rent', { merchant: 'Arriendo' }),
    tx(TODAY, -129_890, 'shopping', { merchant: 'Tienda' }),
  ];
  // Supermercado: 9 compras, $412.600.
  for (let i = 0; i < 9; i += 1) {
    txs.push(
      tx(`2026-10-0${i + 1}`, i === 8 ? -52_600 : -45_000, 'groceries', {
        merchant: 'Supermercado',
      }),
    );
  }
  // Recargas de transporte: 6 recargas, $240.000.
  for (let i = 0; i < 6; i += 1) {
    txs.push(tx(`2026-10-1${i}`, -40_000, 'transport', { merchant: 'Recargas de transporte' }));
  }
  // Restaurantes: 7 visitas, $214.400.
  for (let i = 0; i < 7; i += 1) {
    txs.push(
      tx(`2026-10-2${i}`, i === 6 ? -34_400 : -30_000, 'restaurants', {
        merchant: 'Restaurantes',
      }),
    );
  }
  // 39 smaller purchases at different places, $1.085.510, never today.
  for (let i = 0; i < 39; i += 1) {
    const day = `2026-${i < 3 ? '09' : '10'}-${String(i < 3 ? 28 + i : (i % 26) + 1).padStart(2, '0')}`;
    txs.push(tx(day, i === 38 ? -29_110 : -27_800, 'shopping', { merchant: `Lugar ${i}` }));
  }
  // The previous 30 days: 52 movements, $3.785.200.
  for (let i = 0; i < 52; i += 1) {
    const day = `2026-${i < 3 ? '08' : '09'}-${String(i < 3 ? 29 + i : (i % 27) + 1).padStart(2, '0')}`;
    txs.push(tx(day, i === 51 ? -72_808 : -72_792, 'shopping', { merchant: `Antes ${i}` }));
  }
  return txs;
}

describe('periodSummary (summary card)', () => {
  it('gives the design numbers for "Mes": the last 30 days', () => {
    const s = periodSummary(designMonth(), 'month', TODAY);
    expect(s.range).toEqual({ from: '2026-09-28', to: TODAY });
    expect(s.previousRange).toEqual({ from: '2026-08-29', to: '2026-09-27' });
    expect(s.spendingMinor).toBe(cop(3_482_400));
    expect(s.incomeMinor).toBe(cop(5_580_000));
    expect(s.balanceMinor).toBe(cop(2_097_600));
    expect(s.todayMinor).toBe(cop(129_890));
    expect(s.previousSpendingMinor).toBe(cop(3_785_200));
  });

  it('draws one cumulative point per day for both periods', () => {
    const s = periodSummary(designMonth(), 'month', TODAY);
    expect(s.current).toHaveLength(30);
    expect(s.previous).toHaveLength(30);
    expect(s.current.at(-1)).toEqual({ date: TODAY, cumulativeMinor: cop(3_482_400) });
    expect(s.previous.at(-1)?.cumulativeMinor).toBe(cop(3_785_200));
    // Never goes down: it adds the spending of each day.
    s.current.forEach((p, i) => {
      if (i > 0)
        expect(p.cumulativeMinor).toBeGreaterThanOrEqual(s.current[i - 1]!.cumulativeMinor);
    });
  });

  it('uses 3, 7, 30 and 365 days', () => {
    expect(periodRanges('3d', TODAY).range).toEqual({ from: '2026-10-25', to: TODAY });
    expect(periodRanges('week', TODAY)).toEqual({
      range: { from: '2026-10-21', to: TODAY },
      previousRange: { from: '2026-10-14', to: '2026-10-20' },
    });
    expect(periodRanges('year', TODAY).range.from).toBe('2025-10-28');
  });

  it('is all zeros without movements', () => {
    const s = periodSummary([], 'week', TODAY);
    expect([s.spendingMinor, s.incomeMinor, s.balanceMinor, s.todayMinor]).toEqual([0, 0, 0, 0]);
    expect(s.current.every((p) => p.cumulativeMinor === 0)).toBe(true);
  });
});

describe('periodStats ("Tus estadísticas")', () => {
  it('gives $116.080 a day, Arriendo as the highest, 64 movements and $302.800 saved', () => {
    const { range, previousRange } = periodRanges('month', TODAY);
    expect(periodStats(designMonth(), range, previousRange)).toEqual({
      dailyAverageMinor: cop(116_080),
      highest: {
        amountMinor: cop(1_400_000),
        label: 'Arriendo',
        date: '2026-10-01',
        categoryId: 'rent',
      },
      movementCount: 64,
      movementDelta: 12,
      savedVsPreviousMinor: cop(302_800),
    });
  });

  it('has no highest expense and a negative saving when spending grew', () => {
    const range = { from: '2026-10-01', to: '2026-10-02' };
    const previousRange = { from: '2026-09-29', to: '2026-09-30' };
    const stats = periodStats([tx('2026-10-01', 100_000, 'salary')], range, previousRange);
    expect(stats.highest).toBeNull();
    const more = periodStats(
      [tx('2026-09-30', -10_000, 'restaurants'), tx('2026-10-01', -25_000, 'restaurants')],
      range,
      previousRange,
    );
    expect(more.savedVsPreviousMinor).toBe(cop(-15_000));
  });
});

describe('weekdayPattern ("Por día de la semana")', () => {
  // Monday 5 to Sunday 18 October 2026: every day of the week twice.
  const range = { from: '2026-10-05', to: '2026-10-18' };
  const txs: Transaction[] = [];
  for (let d = 5; d <= 18; d += 1) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    const weekday = weekdayOf(date);
    txs.push(tx(date, weekday === 5 ? -200_000 : weekday === 6 ? -50_000 : -100_000, 'shopping'));
  }

  it('averages each day of the week, Monday first', () => {
    expect(weekdayOf('2026-10-05')).toBe(0);
    expect(weekdayOf('2026-10-11')).toBe(6);
    const p = weekdayPattern(txs, range);
    expect(p.averagesMinor).toEqual([
      cop(100_000),
      cop(100_000),
      cop(100_000),
      cop(100_000),
      cop(100_000),
      cop(200_000),
      cop(50_000),
    ]);
    expect(p.averageMinor).toBe(10_714_285); // $1.500.000 over 14 days, rounded down
  });

  it('finds that Saturdays double the weekdays', () => {
    expect(weekdayPattern(txs, range).peak).toEqual({
      weekday: 5,
      againstWeekdays: true,
      timesPercent: 200,
    });
  });

  it('compares a weekday peak with the other days, and has no peak without spending', () => {
    const friday = [...txs, tx('2026-10-09', -1_000_000, 'shopping')];
    expect(weekdayPattern(friday, range).peak).toMatchObject({
      weekday: 4,
      againstWeekdays: false,
    });
    expect(weekdayPattern([], range)).toEqual({
      averagesMinor: [0, 0, 0, 0, 0, 0, 0],
      averageMinor: 0,
      peak: null,
    });
  });
});

describe('topPlaces ("Dónde más gastas")', () => {
  it('ranks Supermercado, Recargas de transporte and Restaurantes as the design', () => {
    const { range } = periodRanges('month', TODAY);
    const places = topPlaces(designMonth(), range).map((p) => [
      p.label,
      p.count,
      p.categoryId,
      p.totalMinor,
    ]);
    // Arriendo ($1.400.000) is a fixed bill: Billetera shows it, not "Dónde más gastas".
    expect(places).toEqual([
      ['Supermercado', 9, 'groceries', cop(412_600)],
      ['Recargas de transporte', 6, 'transport', cop(240_000)],
      ['Restaurantes', 7, 'restaurants', cop(214_400)],
    ]);
    expect(topPlaces(designMonth(), range, 4)[3]?.label).toBe('Tienda');
  });

  it('ignores income and movements outside the range', () => {
    const range = { from: '2026-10-01', to: '2026-10-31' };
    expect(
      topPlaces([tx('2026-10-02', 50_000, 'salary'), tx('2026-09-30', -9_000, 'groceries')], range),
    ).toEqual([]);
  });
});
