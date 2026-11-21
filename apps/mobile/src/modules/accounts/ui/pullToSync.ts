// Pull to sync on the Dashboard (QA review 2026-11-07, F3): pulled down at the top, the header
// and the page move down with resistance and the indicator above them grows in size and opacity.
// Let go at the maximum, the page holds while M5 syncs (with its 60 s cooldown); let go before,
// it springs back. Pure; worklets.

/** The page moves half as far as the finger. */
const RESISTANCE = 0.5;
/** How far below the top inset the page goes at the maximum. */
const PULL_ROOM = 64;
/** Where the page waits below the top inset while it syncs. */
export const SYNC_HOLD = 56;
/** The indicator's size when it starts to show. */
const MIN_SCALE = 0.4;

/** The furthest the page moves down. */
export function pullMax(topInset: number): number {
  'worklet';
  return topInset + PULL_ROOM;
}

/** How far the page has moved for a finger `translationY` px down. */
export function pullDistance(translationY: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(0, translationY * RESISTANCE));
}

/** The indicator: grows and shows with the pull, and is ready at the maximum. */
export function pullLook(distance: number, max: number) {
  'worklet';
  const progress = max > 0 ? Math.min(1, distance / max) : 0;
  return {
    scale: Math.round((MIN_SCALE + (1 - MIN_SCALE) * progress) * 100) / 100,
    opacity: Math.round(progress * 100) / 100,
    ready: progress >= 1,
  };
}

/** What letting go does: sync and hold below the inset, or spring back. */
export function releasePull(distance: number, max: number): { sync: boolean; to: number } {
  'worklet';
  return distance >= max ? { sync: true, to: max - PULL_ROOM + SYNC_HOLD } : { sync: false, to: 0 };
}
