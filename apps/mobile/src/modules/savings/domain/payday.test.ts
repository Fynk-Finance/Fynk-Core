// The payday reminder: valid input, the next payday at 9:00 Bogotá time, and the salary day.
import { nextPaydayAt, salaryDay, validatePayday } from './payday';

describe('validatePayday', () => {
  it('needs an amount above $0 and a day from 1 to 31', () => {
    expect(validatePayday({ amountMinor: 30_000_000, day: 30 })).toEqual([]);
    expect(validatePayday({ amountMinor: 0, day: 0 })).toEqual(['amount', 'day']);
    expect(validatePayday({ amountMinor: 100, day: 32 })).toEqual(['day']);
  });
});

describe('nextPaydayAt', () => {
  it('is 9:00 Bogotá (14:00 UTC) on the salary day of this month', () => {
    expect(nextPaydayAt(30, new Date('2026-10-28T15:00:00Z'))).toBe('2026-10-30T14:00:00.000Z');
  });

  it('moves to next month once today 9:00 has passed', () => {
    expect(nextPaydayAt(28, new Date('2026-10-28T15:00:00Z'))).toBe('2026-11-28T14:00:00.000Z');
    expect(nextPaydayAt(28, new Date('2026-10-28T13:00:00Z'))).toBe('2026-10-28T14:00:00.000Z');
  });

  it('falls on the last day of a shorter month, and crosses the year', () => {
    expect(nextPaydayAt(31, new Date('2026-11-01T15:00:00Z'))).toBe('2026-11-30T14:00:00.000Z');
    expect(nextPaydayAt(31, new Date('2027-02-01T15:00:00Z'))).toBe('2027-02-28T14:00:00.000Z');
    expect(nextPaydayAt(15, new Date('2026-12-20T15:00:00Z'))).toBe('2027-01-15T14:00:00.000Z');
  });

  it('uses the Bogotá day: 23:00 on the 30th is still the 30th there', () => {
    // 2026-10-31T04:00Z is 30 oct 23:00 in Bogotá; the 31st at 9:00 is next.
    expect(nextPaydayAt(31, new Date('2026-10-31T04:00:00Z'))).toBe('2026-10-31T14:00:00.000Z');
  });
});

describe('salaryDay', () => {
  it('takes the usual day of the biggest salary M10 found', () => {
    expect(
      salaryDay([
        { kind: 'other', usualDay: 5, estimatedMonthlyMinor: 500 },
        { kind: 'salary', usualDay: 15, estimatedMonthlyMinor: 100 },
        { kind: 'salary', usualDay: 30, estimatedMonthlyMinor: 300 },
      ]),
    ).toBe(30);
    expect(salaryDay([{ kind: 'other', usualDay: 5, estimatedMonthlyMinor: 500 }])).toBeNull();
  });
});
