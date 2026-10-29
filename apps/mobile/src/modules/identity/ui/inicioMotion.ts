// Looping motion of the Inicio illustration. The design drives it with CSS keyframes
// (docs/design/sources/light/Inicio.html); here each keyframe list is sampled from one linear
// phase (0 to 1) so that the CSS delay, negative delay and per-segment ease-in-out are exact.
import { useEffect } from 'react';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

/** One CSS keyframe: position in the cycle (0 to 1) and the value there. */
export type Keyframe = readonly [at: number, value: number];

// @keyframes fk-float
export const FLOAT: readonly Keyframe[] = [
  [0, 0],
  [0.5, -10],
  [1, 0],
];
// @keyframes fk-shadow, scaleX and opacity
export const SHADOW_SCALE: readonly Keyframe[] = [
  [0, 1],
  [0.5, 0.86],
  [1, 1],
];
export const SHADOW_OPACITY: readonly Keyframe[] = [
  [0, 1],
  [0.5, 0.65],
  [1, 1],
];
// @keyframes fk-shine, translateX in card units
export const SHINE: readonly Keyframe[] = [
  [0, 0],
  [0.58, 0],
  [0.82, 340],
  [1, 340],
];
// @keyframes fk-twinkle, opacity and scale
export const TWINKLE_OPACITY: readonly Keyframe[] = [
  [0, 0.25],
  [0.5, 1],
  [1, 0.25],
];
export const TWINKLE_SCALE: readonly Keyframe[] = [
  [0, 0.6],
  [0.5, 1],
  [1, 0.6],
];
// @keyframes fk-drop, translateY
export const DROP: readonly Keyframe[] = [
  [0, 0],
  [0.68, 0],
  [0.78, -16],
  [0.88, 0],
  [0.93, -3],
  [0.97, 0],
  [1, 0],
];

function bezier(u: number, a: number, b: number): number {
  'worklet';
  const m = 1 - u;
  return 3 * m * m * u * a + 3 * m * u * u * b + u * u * u;
}

/** CSS `ease-in-out`, cubic-bezier(.42, 0, .58, 1). */
export function easeInOut(t: number): number {
  'worklet';
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  let lo = 0;
  let hi = 1;
  let u = t;
  for (let i = 0; i < 24; i++) {
    u = (lo + hi) / 2;
    if (bezier(u, 0.42, 0.58) < t) lo = u;
    else hi = u;
  }
  return bezier(u, 0, 1);
}

/** Value of a keyframe list at `phase` (0 to 1), easing every segment like CSS does. */
export function sampleKeyframes(frames: readonly Keyframe[], phase: number): number {
  'worklet';
  for (let i = 1; i < frames.length; i++) {
    const from = frames[i - 1];
    const to = frames[i];
    if (!from || !to) continue;
    if (phase <= to[0]) {
      if (to[0] === from[0]) return to[1];
      const t = (phase - from[0]) / (to[0] - from[0]);
      return from[1] + (to[1] - from[1]) * easeInOut(t);
    }
  }
  const last = frames[frames.length - 1];
  return last ? last[1] : 0;
}

/**
 * Phase of an infinite CSS animation. A positive delay waits at the first keyframe, a negative
 * delay starts that far into the cycle.
 */
export function useLoopPhase(durationMs: number, delayMs: number) {
  const offset = delayMs < 0 ? (-delayMs % durationMs) / durationMs : 0;
  const phase = useSharedValue(offset);
  useEffect(() => {
    const cycle = withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }),
        withTiming(1, { duration: durationMs, easing: Easing.linear }),
      ),
      -1,
    );
    phase.value = offset;
    phase.value =
      delayMs < 0
        ? withSequence(
            withTiming(1, { duration: durationMs * (1 - offset), easing: Easing.linear }),
            cycle,
          )
        : withDelay(delayMs, cycle);
    return () => cancelAnimation(phase);
  }, [delayMs, durationMs, offset, phase]);
  return phase;
}
