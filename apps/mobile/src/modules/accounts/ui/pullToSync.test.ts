// QA review 2026-11-07, F3 (SCRUM-93): pulling the top of the Dashboard down moves everything
// down, the indicator grows in size and opacity, and releasing at the maximum syncs.
import { pullDistance, pullLook, pullMax, releasePull, SYNC_HOLD } from './pullToSync';

const max = pullMax(40);

describe('pullDistance', () => {
  it('moves half as far as the finger, never up, and stops at the maximum', () => {
    expect(max).toBe(40 + 64);
    expect(pullDistance(60, max)).toBe(30);
    expect(pullDistance(-30, max)).toBe(0);
    expect(pullDistance(1000, max)).toBe(max);
  });
});

describe('pullLook', () => {
  it('grows the indicator in size and opacity with the pull', () => {
    expect(pullLook(0, max)).toEqual({ scale: 0.4, opacity: 0, ready: false });
    expect(pullLook(max / 2, max)).toEqual({ scale: 0.7, opacity: 0.5, ready: false });
    expect(pullLook(max, max)).toEqual({ scale: 1, opacity: 1, ready: true });
  });
});

describe('releasePull', () => {
  it('syncs only when let go at the maximum, and holds the page while it syncs', () => {
    expect(releasePull(max, max)).toEqual({ sync: true, to: 40 + SYNC_HOLD });
    expect(releasePull(max - 10, max)).toEqual({ sync: false, to: 0 });
  });
});
