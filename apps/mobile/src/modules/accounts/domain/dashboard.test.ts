import type { Transaction } from '@shared/domain/types';

import { monthSummary } from './dashboard';

describe('monthSummary (temporary, TODO(M10))', () => {
  const tx = (bookedAt: string, amountMinor: number, status: Transaction['status'] = 'booked') =>
    ({ id: bookedAt + amountMinor, bookedAt, amountMinor, status }) as Transaction;
  // 30 Oct 2026, 10:00 in Bogotá.
  const now = new Date('2026-10-30T15:00:00Z');

  it('adds income and spending of the current month in Bogotá', () => {
    expect(
      monthSummary(
        [
          tx('2026-10-25T14:00:00Z', 520_000_000),
          tx('2026-10-24T20:00:00Z', -28_640_000),
          tx('2026-10-01T04:59:00Z', -1_000_000), // 30 Sep, 23:59 in Bogotá
          tx('2026-11-01T04:00:00Z', -2_000_000), // 31 Oct, 23:00 in Bogotá
          tx('2026-10-20T12:00:00Z', -9_900_000, 'pending'),
        ],
        now,
      ),
    ).toEqual({ incomeMinor: 520_000_000, spendingMinor: 30_640_000 });
  });

  it('is zero without movements', () => {
    expect(monthSummary([], now)).toEqual({ incomeMinor: 0, spendingMinor: 0 });
  });
});
