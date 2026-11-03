import {
  activeFilterCount,
  filterFromParams,
  filterProblems,
  formatDayInput,
  parseDayInput,
  presetOf,
  presetRange,
} from './filter';

// Tuesday 22 Sep 2026, 9:00 in Bogotá.
const now = new Date('2026-09-22T14:00:00Z');

describe('presetRange (HU-016 filtro por fecha)', () => {
  it('gives this month up to today, the whole previous month and the last 3 months', () => {
    expect(presetRange('this_month', now)).toEqual({ from: '2026-09-01', to: '2026-09-22' });
    expect(presetRange('last_month', now)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    expect(presetRange('last_3_months', now)).toEqual({ from: '2026-06-23', to: '2026-09-22' });
  });

  it('uses the Bogotá day, not the UTC one, at the edge of a month', () => {
    // 1 Oct 2026 at 3:00 UTC is still 30 Sep in Bogotá.
    const lateSep30 = new Date('2026-10-01T03:00:00Z');
    expect(presetRange('this_month', lateSep30)).toEqual({ from: '2026-09-01', to: '2026-09-30' });
    expect(presetRange('last_month', lateSep30)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('crosses years and short months', () => {
    const jan = new Date('2027-01-10T14:00:00Z');
    expect(presetRange('last_month', jan)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    const may31 = new Date('2026-05-31T14:00:00Z');
    expect(presetRange('last_3_months', may31)).toEqual({ from: '2026-03-01', to: '2026-05-31' });
  });

  it('knows which preset a range is', () => {
    expect(presetOf({ from: '2026-08-01', to: '2026-08-31' }, now)).toBe('last_month');
    expect(presetOf({ from: '2026-08-02', to: '2026-08-31' }, now)).toBeNull();
  });
});

describe('filterProblems', () => {
  it('accepts a correct filter', () => {
    expect(
      filterProblems({
        from: '2026-09-01',
        to: '2026-09-30',
        minAmountMinor: 0,
        maxAmountMinor: 1,
      }),
    ).toEqual([]);
  });

  it('refuses a range that ends before it starts and amounts that make no sense', () => {
    expect(filterProblems({ from: '2026-09-30', to: '2026-09-01' })).toEqual(['dates']);
    expect(filterProblems({ minAmountMinor: 500, maxAmountMinor: 100 })).toEqual(['amounts']);
    expect(filterProblems({ minAmountMinor: -1 })).toEqual(['amounts']);
    expect(filterProblems({ maxAmountMinor: 1.5 })).toEqual(['amounts']);
  });
});

describe('activeFilterCount', () => {
  it('counts each kind of filter once', () => {
    expect(activeFilterCount({})).toBe(0);
    expect(
      activeFilterCount({
        from: '2026-09-01',
        to: '2026-09-30',
        minAmountMinor: 100,
        maxAmountMinor: 200,
        kind: 'expense',
        accountIds: ['a', 'b'],
        categoryIds: [],
      }),
    ).toBe(4);
  });
});

describe('filterFromParams', () => {
  it('opens with the category and month of Estadísticas, or the account of Detalle de cuenta', () => {
    expect(
      filterFromParams({ categoryId: 'restaurants', from: '2026-09-01', to: '2026-09-30' }),
    ).toEqual({ categoryIds: ['restaurants'], from: '2026-09-01', to: '2026-09-30' });
    expect(filterFromParams({ accountId: 'acc-1' })).toEqual({ accountIds: ['acc-1'] });
  });

  it('ignores anything malformed', () => {
    expect(filterFromParams(undefined)).toEqual({});
    expect(filterFromParams({ categoryId: 'pizza', from: '1 sep', to: 3 })).toEqual({});
    expect(filterFromParams({ from: '2026-09-30', to: '2026-09-01' })).toEqual({});
  });
});

describe('day input', () => {
  it('reads the day the way people in Colombia write it', () => {
    expect(parseDayInput('22/09/2026')).toBe('2026-09-22');
    expect(parseDayInput(' 2-9-2026 ')).toBe('2026-09-02');
    expect(formatDayInput('2026-09-02')).toBe('02/09/2026');
  });

  it('refuses days that do not exist and other text', () => {
    expect(parseDayInput('31/02/2026')).toBeNull();
    expect(parseDayInput('2026-09-22')).toBeNull();
    expect(parseDayInput('ayer')).toBeNull();
  });
});
