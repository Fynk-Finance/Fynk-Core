// Dragging the Dashboard header to open or close Detalle de cuentas (QA review 2026-11-07, G1):
// the panel follows the finger, then settles open or closed. Pure; worklets.

/** A release faster than this (px/s) settles the way the finger was going. */
const FLICK = 500;

/** Openness (0 closed, 1 open) while dragging `translationY` px from `start`. */
export function dragOpenness(start: number, translationY: number, panelHeight: number): number {
  'worklet';
  if (panelHeight <= 0) return start;
  return Math.min(1, Math.max(0, start + translationY / panelHeight));
}

/** Where the panel settles on release: a flick wins, otherwise the nearest end. */
export function settleOpenness(openness: number, velocityY: number): 0 | 1 {
  'worklet';
  if (velocityY > FLICK) return 1;
  if (velocityY < -FLICK) return 0;
  return openness >= 0.5 ? 1 : 0;
}
