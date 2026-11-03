import { addDays, bogotaDay, bogotaDayStart, bogotaRange, canonicalInstant } from './bogota';

describe('Bogotá days', () => {
  it('gives the Bogotá day of an instant, which is the day before late at night in UTC', () => {
    expect(bogotaDay('2026-10-26T04:59:59Z')).toBe('2026-10-25');
    expect(bogotaDay('2026-10-26T05:00:00Z')).toBe('2026-10-26');
  });

  it('starts a Bogotá day at 05:00 UTC', () => {
    expect(bogotaDayStart('2026-10-25')).toBe('2026-10-25T05:00:00.000Z');
  });

  it('includes both days of a range', () => {
    expect(bogotaRange('2026-09-01', '2026-09-30')).toEqual({
      start: '2026-09-01T05:00:00.000Z',
      end: '2026-10-01T05:00:00.000Z',
    });
  });

  it('refuses a range that ends before it starts and dates that do not exist', () => {
    expect(() => bogotaRange('2026-09-30', '2026-09-01')).toThrow(RangeError);
    expect(() => bogotaDayStart('2026-02-30')).toThrow('Invalid date');
    expect(() => bogotaDayStart('25/10/2026')).toThrow('Invalid date');
  });

  it('adds days across months', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('stores instants in UTC with milliseconds so text order is time order', () => {
    expect(canonicalInstant('2026-10-25T09:03:00-05:00')).toBe('2026-10-25T14:03:00.000Z');
    expect(() => canonicalInstant('ayer')).toThrow('Invalid date');
  });
});
