// The burst of stars and squares that pops out of the current onboarding segment (OnbNombre,
// `pb-pop`): each bit fades in, flies to (dx, dy) while it scales and turns, then fades out.
// `cubic-bezier(.15,.7,.3,1)`. Not drawn when reduced motion is on. The design's dark export turns
// the white squares navy; that is an export bug, so they stay white in both themes.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme';

const STAR = 'M0 -11C.6 -4 4 -.6 11 0 4 .6 .6 4 0 11 -.6 4 -4 .6 -11 0 -4 -.6 -.6 -4 0 -11Z';
const EASE = Easing.bezier(0.15, 0.7, 0.3, 1);

interface Bit {
  /** Start, in % of the segment width. */
  left: number;
  dx: number;
  dy: number;
  size: number;
  delay: number;
  duration: number;
  /** Final rotation in degrees and final scale (it starts at 0.2). */
  rotate: number;
  scale: number;
  shape: 'star' | 'square';
  radius?: number;
  color: 'onPrimary' | 'accent' | 'accentSoft';
}

// The 18 bits of the design, in its order. One per line, like a table.
// prettier-ignore
const BITS: readonly Bit[] = [
  { left: 39, dx: -11, dy: 21, size: 14, delay: 390, duration: 830, rotate: -85, scale: 0.77, shape: 'star', color: 'onPrimary' },
  { left: 81, dx: -31, dy: -18, size: 14, delay: 690, duration: 760, rotate: -39, scale: 1.12, shape: 'square', radius: 4, color: 'onPrimary' },
  { left: 91, dx: -1, dy: -37, size: 10, delay: 790, duration: 1030, rotate: -49, scale: 0.88, shape: 'star', color: 'onPrimary' },
  { left: 60, dx: 20, dy: 25, size: 10, delay: 580, duration: 980, rotate: -3, scale: 1.11, shape: 'square', radius: 3, color: 'accent' },
  { left: 77, dx: -17, dy: -35, size: 14, delay: 640, duration: 810, rotate: -77, scale: 0.79, shape: 'star', color: 'accent' },
  { left: 38, dx: 24, dy: -33, size: 9, delay: 420, duration: 800, rotate: 71, scale: 0.98, shape: 'square', radius: 3, color: 'onPrimary' },
  { left: 92, dx: 12, dy: -16, size: 10, delay: 750, duration: 1080, rotate: 19, scale: 0.7, shape: 'star', color: 'accentSoft' },
  { left: 95, dx: -29, dy: -18, size: 10, delay: 790, duration: 1040, rotate: 147, scale: 0.83, shape: 'square', radius: 3, color: 'accentSoft' },
  { left: 81, dx: -2, dy: -20, size: 14, delay: 720, duration: 880, rotate: 156, scale: 0.77, shape: 'star', color: 'onPrimary' },
  { left: 80, dx: -7, dy: 15, size: 12, delay: 690, duration: 760, rotate: 118, scale: 1.06, shape: 'square', radius: 4, color: 'accent' },
  { left: 30, dx: -10, dy: -39, size: 14, delay: 400, duration: 1070, rotate: -95, scale: 0.73, shape: 'star', color: 'onPrimary' },
  { left: 98, dx: 9, dy: 16, size: 12, delay: 690, duration: 1100, rotate: -118, scale: 0.9, shape: 'square', radius: 4, color: 'accent' },
  { left: 67, dx: -25, dy: -30, size: 9, delay: 650, duration: 760, rotate: -17, scale: 0.87, shape: 'star', color: 'accentSoft' },
  { left: 67, dx: 34, dy: 40, size: 10, delay: 550, duration: 820, rotate: -164, scale: 0.89, shape: 'square', radius: 3, color: 'onPrimary' },
  { left: 81, dx: -1, dy: -35, size: 8, delay: 630, duration: 960, rotate: 2, scale: 1.09, shape: 'star', color: 'accent' },
  { left: 55, dx: 10, dy: -15, size: 9, delay: 510, duration: 780, rotate: -157, scale: 1, shape: 'square', radius: 3, color: 'onPrimary' },
  { left: 74, dx: 5, dy: -28, size: 10, delay: 710, duration: 890, rotate: -149, scale: 0.84, shape: 'star', color: 'accentSoft' },
  { left: 97, dx: -16, dy: -17, size: 9, delay: 800, duration: 830, rotate: -25, scale: 1, shape: 'square', radius: 3, color: 'accent' },
];

function BurstBit({ bit }: { bit: Bit }) {
  const { colors } = useTheme();
  const move = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const { delay, duration } = bit;
    move.value = withDelay(delay, withTiming(1, { duration, easing: EASE }));
    // Keyframes 0 % → 18 % → 65 % → 100 %: fade in, hold, fade out.
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: duration * 0.18, easing: EASE }),
        withTiming(1, { duration: duration * 0.47 }),
        withTiming(0, { duration: duration * 0.35, easing: EASE }),
      ),
    );
    return () => {
      cancelAnimation(move);
      cancelAnimation(opacity);
    };
  }, [bit, move, opacity]);

  const animated = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: bit.dx * move.value },
      { translateY: bit.dy * move.value },
      { scale: 0.2 + (bit.scale - 0.2) * move.value },
      { rotate: `${bit.rotate * move.value}deg` },
    ],
  }));

  const color = colors[bit.color];
  const box = {
    left: `${bit.left}%` as const,
    width: bit.size,
    height: bit.size,
    // translate(-50%, -50%): the bit is centered on its start point.
    marginLeft: -bit.size / 2,
    marginTop: -bit.size / 2,
  };
  return (
    <Animated.View
      style={[
        styles.bit,
        box,
        bit.shape === 'square' ? { borderRadius: bit.radius, backgroundColor: color } : null,
        animated,
      ]}
    >
      {bit.shape === 'star' ? (
        <Svg width={bit.size} height={bit.size} viewBox="-12 -12 24 24">
          <Path d={STAR} fill={color} />
        </Svg>
      ) : null}
    </Animated.View>
  );
}

/** Placed inside a segment of the step bar: the bits start 4 px below its top edge. */
export function StepBurst() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={styles.layer} testID="step-burst">
      {BITS.map((bit, i) => (
        <BurstBit key={i} bit={bit} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', left: 0, right: 0, top: 4, height: 0 },
  bit: { position: 'absolute', top: 0 },
});
