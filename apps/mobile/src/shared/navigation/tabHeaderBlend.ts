// How the tabs' shared blue header changes between tabs (QA review 2026-11-07, G2). `position`
// is the pager's: the tab index at rest, fractional while a swipe or a tap moves the pages. The
// card's height and every per-tab look are blended between the two tabs around it, so they follow
// the finger; with Reduce Motion they jump to the nearest tab. Pure; worklets.

/** A tab whose header has not been measured yet (a lazy tab never opened). */
export const UNKNOWN = -1;

/** Header flick: a drag this long (px), or a release this fast (px/s), switches tab. */
const FLICK_DISTANCE = 60;
const FLICK_VELOCITY = 500;

/** The tab closest to `position`. */
export function nearestTab(position: number, count: number): number {
  'worklet';
  return Math.min(count - 1, Math.max(0, Math.round(position)));
}

/** The per-tab `values` blended at `position`. */
export function blend(position: number, values: readonly number[], reduceMotion: boolean): number {
  'worklet';
  const count = values.length;
  if (count === 0) return 0;
  if (reduceMotion) return values[nearestTab(position, count)] ?? 0;
  const p = Math.min(count - 1, Math.max(0, position));
  const from = Math.floor(p);
  const to = Math.min(count - 1, from + 1);
  const f = p - from;
  return (values[from] ?? 0) * (1 - f) + (values[to] ?? 0) * f;
}

/** Unknown heights take the nearest known one (the lower tab on a tie), or 0 if none is known. */
export function fillUnknown(heights: readonly number[]): number[] {
  'worklet';
  const filled: number[] = [];
  for (let i = 0; i < heights.length; i += 1) {
    let value = heights[i] ?? UNKNOWN;
    for (let d = 1; value === UNKNOWN && d < heights.length; d += 1) {
      const below = heights[i - d];
      const above = heights[i + d];
      if (below !== undefined && below !== UNKNOWN) value = below;
      else if (above !== undefined && above !== UNKNOWN) value = above;
    }
    filled.push(value === UNKNOWN ? 0 : value);
  }
  return filled;
}

/**
 * Opacity of the content of tab `index`: full at its tab, gone halfway to the next, so the old
 * content fades out before the new one fades in.
 */
export function layerOpacity(position: number, index: number, reduceMotion: boolean): number {
  'worklet';
  const distance = Math.abs(position - index);
  if (reduceMotion) return Math.round(position) === index ? 1 : 0;
  return Math.min(1, Math.max(0, 1 - 2 * distance));
}

/** The tab a sideways flick on the header goes to, or null. A flick to the left goes forward. */
export function flickTarget(
  index: number,
  count: number,
  translationX: number,
  velocityX: number,
): number | null {
  'worklet';
  let direction = 0;
  if (Math.abs(translationX) >= FLICK_DISTANCE) direction = translationX < 0 ? 1 : -1;
  else if (Math.abs(velocityX) >= FLICK_VELOCITY) direction = velocityX < 0 ? 1 : -1;
  if (direction === 0) return null;
  const target = index + direction;
  return target >= 0 && target < count ? target : null;
}
