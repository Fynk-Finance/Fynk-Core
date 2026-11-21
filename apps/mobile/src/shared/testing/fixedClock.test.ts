import { createFixedClock } from './fixedClock';

describe('createFixedClock', () => {
  it('returns the same instant until moved', () => {
    const clock = createFixedClock('2026-10-26T15:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-10-26T15:00:00.000Z');
    expect(clock.now().toISOString()).toBe('2026-10-26T15:00:00.000Z');
  });

  it('returns a new Date each time, so callers cannot change it', () => {
    const clock = createFixedClock('2026-10-26T15:00:00Z');
    clock.now().setFullYear(2000);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });

  it('can be set and advanced', () => {
    const clock = createFixedClock('2026-10-26T15:00:00Z');
    clock.advance(60_000);
    expect(clock.now().toISOString()).toBe('2026-10-26T15:01:00.000Z');
    clock.set('2027-06-30T05:00:00Z');
    expect(clock.now().toISOString()).toBe('2027-06-30T05:00:00.000Z');
  });

  it('rejects invalid dates', () => {
    expect(() => createFixedClock('not a date')).toThrow(RangeError);
    expect(() => createFixedClock('2026-10-26T15:00:00Z').set('nope')).toThrow(RangeError);
  });
});
