import { daysInMonth, nextCharge, occurrencesInMonth } from './schedule';
import { MON_TO_FRI, WEEKDAY } from './types';

const OCTOBER_2026 = { year: 2026, month: 10 };

describe('occurrencesInMonth', () => {
  it('counts Mondays and weekdays of October 2026', () => {
    expect(
      occurrencesInMonth({ periodicity: 'weekly', weekdaysMask: WEEKDAY.mon }, OCTOBER_2026),
    ).toBe(4);
    expect(
      occurrencesInMonth({ periodicity: 'daily', weekdaysMask: MON_TO_FRI }, OCTOBER_2026),
    ).toBe(22);
  });

  it('counts a monthly item once, even on the 31st of a 30 day month', () => {
    expect(
      occurrencesInMonth({ periodicity: 'monthly', anchorDay: 31 }, { year: 2026, month: 11 }),
    ).toBe(1);
  });

  it('counts a yearly item only in its month', () => {
    const yearly = { periodicity: 'yearly' as const, anchorDate: '2026-03-15' };
    expect(occurrencesInMonth(yearly, { year: 2027, month: 3 })).toBe(1);
    expect(occurrencesInMonth(yearly, OCTOBER_2026)).toBe(0);
  });

  it('counts a biweekly item 2 or 3 times, and not before it started', () => {
    const biweekly = { periodicity: 'biweekly' as const, anchorDate: '2026-10-02' };
    expect(occurrencesInMonth(biweekly, OCTOBER_2026)).toBe(3); // 2, 16, 30
    expect(occurrencesInMonth(biweekly, { year: 2026, month: 11 })).toBe(2); // 13, 27
    expect(occurrencesInMonth(biweekly, { year: 2026, month: 9 })).toBe(0);
  });
});

describe('nextCharge', () => {
  it('moves the 31st to the 30th in a 30 day month, then back to the 31st', () => {
    const on31 = { periodicity: 'monthly' as const, anchorDay: 31 };
    expect(nextCharge(on31, '2026-11-02')).toBe('2026-11-30');
    expect(nextCharge(on31, '2026-12-01')).toBe('2026-12-31');
    expect(nextCharge(on31, '2027-02-01')).toBe('2027-02-28');
  });

  it('is today when the charge is today, next month when it already passed', () => {
    const day1 = { periodicity: 'monthly' as const, anchorDay: 1 };
    expect(nextCharge(day1, '2026-11-01')).toBe('2026-11-01');
    expect(nextCharge(day1, '2026-12-02')).toBe('2027-01-01');
  });

  it('finds the next Monday and the next weekday', () => {
    // Wednesday 28 Oct 2026
    expect(nextCharge({ periodicity: 'weekly', weekdaysMask: WEEKDAY.mon }, '2026-10-28')).toBe(
      '2026-11-02',
    );
    expect(nextCharge({ periodicity: 'daily', weekdaysMask: MON_TO_FRI }, '2026-10-31')).toBe(
      '2026-11-02',
    );
  });

  it('returns null for a weekly item without weekdays', () => {
    expect(nextCharge({ periodicity: 'weekly', weekdaysMask: 0 }, '2026-10-28')).toBeNull();
  });

  it('steps biweekly items 14 days from their anchor', () => {
    const biweekly = { periodicity: 'biweekly' as const, anchorDate: '2026-10-02' };
    expect(nextCharge(biweekly, '2026-09-20')).toBe('2026-10-02');
    expect(nextCharge(biweekly, '2026-10-17')).toBe('2026-10-30');
    expect(nextCharge(biweekly, '2026-10-30')).toBe('2026-10-30');
  });

  it('keeps a yearly item on its day, and 29 Feb on 28 Feb in other years', () => {
    expect(nextCharge({ periodicity: 'yearly', anchorDate: '2026-03-15' }, '2026-10-28')).toBe(
      '2027-03-15',
    );
    expect(nextCharge({ periodicity: 'yearly', anchorDate: '2028-02-29' }, '2026-10-28')).toBe(
      '2027-02-28',
    );
  });

  it('rejects a value that is not a calendar date', () => {
    expect(() =>
      nextCharge({ periodicity: 'biweekly', anchorDate: '2026-10-02' }, '28/10/2026'),
    ).toThrow(RangeError);
  });
});

describe('daysInMonth', () => {
  it('knows February in leap and common years', () => {
    expect(daysInMonth({ year: 2028, month: 2 })).toBe(29);
    expect(daysInMonth({ year: 2026, month: 2 })).toBe(28);
  });
});
