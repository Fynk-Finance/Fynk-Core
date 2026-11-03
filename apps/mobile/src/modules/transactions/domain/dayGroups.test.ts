import { bankTx } from '../testing/fixtures';
import { groupByDay } from './dayGroups';

// Tuesday 22 Sep 2026, 9:00 in Bogotá.
const now = new Date('2026-09-22T14:00:00Z');

describe('groupByDay', () => {
  it('groups by Bogotá day with today, yesterday and the weekday, and adds the net', () => {
    const rows = [
      bankTx({ id: 'salary', bookedAt: '2026-09-22T13:00:00Z', amountMinor: 520_000_000 }),
      bankTx({ id: 'shop', bookedAt: '2026-09-22T12:00:00Z', amountMinor: -2_010_000 }),
      // 11 p.m. on the 21st in Bogotá is already the 22nd in UTC.
      bankTx({ id: 'late', bookedAt: '2026-09-22T04:00:00Z', amountMinor: -4_100_000 }),
      bankTx({ id: 'sunday', bookedAt: '2026-09-20T18:00:00Z', amountMinor: -30_000_000 }),
    ];
    expect(groupByDay(rows, now)).toEqual([
      {
        day: '2026-09-22',
        relative: 'today',
        weekday: 2,
        netMinor: 517_990_000,
        items: [rows[0], rows[1]],
      },
      {
        day: '2026-09-21',
        relative: 'yesterday',
        weekday: 1,
        netMinor: -4_100_000,
        items: [rows[2]],
      },
      { day: '2026-09-20', relative: null, weekday: 0, netMinor: -30_000_000, items: [rows[3]] },
    ]);
  });

  it('gives no groups for no rows', () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});
