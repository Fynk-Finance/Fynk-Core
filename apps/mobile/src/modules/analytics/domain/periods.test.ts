import { periodRange, rangeDays } from './periods';

describe('periodRange (HU-021 selección de períodos, HU-022 rangos de fechas)', () => {
  const today = '2026-10-28';

  it('gives this month up to today, the previous month and the last 3 months', () => {
    expect(periodRange('this_month', today)).toEqual({ from: '2026-10-01', to: '2026-10-28' });
    expect(periodRange('last_month', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(periodRange('last_3_months', today)).toEqual({ from: '2026-08-01', to: '2026-10-28' });
    expect(periodRange('last_month', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('accepts a valid custom range and rejects an invalid one', () => {
    expect(periodRange('custom', today, { from: '2026-02-01', to: '2026-02-28' })).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(periodRange('custom', today, { from: '2026-02-30', to: '2026-03-01' })).toBeNull();
    expect(periodRange('custom', today, { from: '2026-03-01', to: '2026-02-01' })).toBeNull();
    expect(periodRange('custom', today)).toBeNull();
  });

  it('counts the days of a range', () => {
    expect(rangeDays({ from: '2026-09-29', to: '2026-10-28' })).toBe(30);
  });
});
