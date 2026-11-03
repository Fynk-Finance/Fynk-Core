import { bankTx } from '../testing/fixtures';
import { pageLimit, toPage, toStoreQuery } from './query';

describe('toStoreQuery', () => {
  it('turns Bogotá days into UTC bounds, end excluded', () => {
    expect(toStoreQuery({ from: '2026-09-01', to: '2026-09-30', accountIds: ['a'] })).toEqual({
      start: '2026-09-01T05:00:00.000Z',
      end: '2026-10-01T05:00:00.000Z',
      accountIds: ['a'],
    });
  });

  it('accepts an open start or end and ignores an empty account list', () => {
    expect(toStoreQuery({ from: '2026-09-01', accountIds: [] })).toEqual({
      start: '2026-09-01T05:00:00.000Z',
    });
    expect(toStoreQuery({ to: '2026-09-30' })).toEqual({ end: '2026-10-01T05:00:00.000Z' });
  });
});

describe('pages', () => {
  it('uses 20 rows by default and caps big pages', () => {
    expect(pageLimit(undefined)).toBe(20);
    expect(pageLimit(5000)).toBe(200);
    expect(() => pageLimit(0)).toThrow(RangeError);
    expect(() => pageLimit(2.5)).toThrow(RangeError);
  });

  it('gives a cursor only when there is one more row', () => {
    const rows = [
      bankTx({ id: 'b', bookedAt: '2026-10-02T00:00:00.000Z' }),
      bankTx({ id: 'a', bookedAt: '2026-10-01T00:00:00.000Z' }),
    ];
    expect(toPage(rows, 1)).toEqual({
      items: [rows[0]],
      nextCursor: { bookedAt: '2026-10-02T00:00:00.000Z', id: 'b' },
    });
    expect(toPage(rows, 2).nextCursor).toBeNull();
  });
});
