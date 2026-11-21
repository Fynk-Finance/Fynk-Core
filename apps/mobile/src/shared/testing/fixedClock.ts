// A Clock for tests: always returns the time it was given, until a test moves it.
import type { Clock, IsoDateTime } from '../domain/types';

export interface FixedClock extends Clock {
  set(at: IsoDateTime): void;
  advance(ms: number): void;
}

export function createFixedClock(at: IsoDateTime): FixedClock {
  let current = Date.parse(at);
  if (Number.isNaN(current)) throw new RangeError(`Invalid date: ${at}`);
  return {
    now: () => new Date(current),
    set(next) {
      const parsed = Date.parse(next);
      if (Number.isNaN(parsed)) throw new RangeError(`Invalid date: ${next}`);
      current = parsed;
    },
    advance(ms) {
      current += ms;
    },
  };
}
