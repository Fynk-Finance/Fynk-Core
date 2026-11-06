// The motion of Listo (OnbListo.html): the hero waits low and large, then moves up (`ls-hero`);
// the check pops (`ls-check`) and its path draws (`ls-path`); the texts fade up (`ls-t1`,
// `ls-t2`); the bits burst out of the check (`ls-burst`) and the sparks pop and twinkle
// (`ls-spark`); the sheet slides up (`ls-sheet`), then its rows fade up and their checks pop
// (`ls-row`, `ls-ok`). Nothing moves, and the bits are not drawn, when reduced motion is on.
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
  type WithTimingConfig,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTheme, type PaletteToken } from '@shared/ui';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const STAR = 'M0 -11C.6 -4 4 -.6 11 0 4 .6 .6 4 0 11 -.6 4 -4 .6 -11 0 -4 -.6 -.6 -4 0 -11Z';
const CHECK = 'M20 6 9 17l-5-5';

const HERO_EASE = Easing.bezier(0.65, 0, 0.35, 1);
const POP_EASE = Easing.bezier(0.34, 1.56, 0.64, 1);
const BURST_EASE = Easing.bezier(0.15, 0.7, 0.3, 1);
const SHEET_EASE = Easing.bezier(0.22, 1, 0.36, 1);
const FADE_EASE = Easing.out(Easing.ease);

/** Start of the rows' fade (2.00 s) and of their checks' pop (2.25 s), 0.08 s apart. */
export const ROW_DELAY = 2000;
export const OK_DELAY = 2250;
export const ROW_STEP = 80;

/** A value that runs from 0 to 1 once after `delay`, or starts at 1 with reduced motion. */
function useProgress(
  duration: number,
  delay: number,
  easing: WithTimingConfig['easing'] = FADE_EASE,
): SharedValue<number> {
  const reduceMotion = useReducedMotion();
  const value = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    value.value = withDelay(delay, withTiming(1, { duration, easing }));
    return () => cancelAnimation(value);
  }, [delay, duration, easing, reduceMotion, value]);
  return value;
}

/** `ls-hero`: translateY(150) scale(1.25) until 62 % of 1.9 s, then to its place. */
export function useHeroMotion() {
  const t = useProgress(1900 * 0.38, 1900 * 0.62, HERO_EASE);
  return useAnimatedStyle(() => ({
    transform: [{ translateY: 150 * (1 - t.value) }, { scale: 1.25 - 0.25 * t.value }],
  }));
}

/** `ls-fade`: opacity 0 and 12 px lower, 0.4 s (rows 0.45 s). */
export function useFadeUp(delay: number, duration = 400) {
  const t = useProgress(duration, delay);
  return useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ translateY: 12 * (1 - t.value) }],
  }));
}

/** `ls-pop`: scale 0 at −20°, 1.15 at 4° (60 %), then 1 at 0° (the check and the row badges). */
export function usePop(delay: number, duration: number) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    t.value = withDelay(
      delay,
      withSequence(
        withTiming(0.6, { duration: duration * 0.6, easing: POP_EASE }),
        withTiming(1, { duration: duration * 0.4, easing: POP_EASE }),
      ),
    );
    return () => cancelAnimation(t);
  }, [delay, duration, reduceMotion, t]);
  return useAnimatedStyle(() => {
    const first = Math.min(t.value / 0.6, 1);
    const second = Math.max((t.value - 0.6) / 0.4, 0);
    const scale = t.value <= 0.6 ? 1.15 * first : 1.15 - 0.15 * second;
    const rotate = t.value <= 0.6 ? -20 + 24 * first : 4 - 4 * second;
    return { transform: [{ scale }, { rotate: `${rotate}deg` }] };
  });
}

/** `ls-sheet`: up from 105 % of its height, 0.55 s after 1.7 s. */
export function useSheetMotion(height: number) {
  const t = useProgress(550, 1700, SHEET_EASE);
  return useAnimatedStyle(() => ({ transform: [{ translateY: height * 1.05 * (1 - t.value) }] }));
}

/** The 56 px check of the hero, drawn by `ls-path` (dash 30, 0.35 s after 0.42 s). */
export function DrawnCheck({ color }: { color: string }) {
  const t = useProgress(350, 420);
  const props = useAnimatedProps(() => ({ strokeDashoffset: 30 * (1 - t.value) }));
  return (
    <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
      <AnimatedPath
        d={CHECK}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={30}
        animatedProps={props}
      />
    </Svg>
  );
}

type BitColor = Extract<PaletteToken, 'onPrimary' | 'accent' | 'accentSoft' | 'cardShapeLighter'>;

interface Bit {
  dx: number;
  dy: number;
  size: number;
  /** Corner radius; 999 is a circle. */
  radius: number;
  delay: number;
  duration: number;
  rotate: number;
  scale: number;
  color: BitColor;
}

// The 30 bits of the design, in its order (`--dx --dy --s --br --d --du --r --sc`).
// prettier-ignore
const BITS: readonly Bit[] = [
  { dx: 94, dy: -10, size: 12, radius: 999, delay: 590, duration: 740, rotate: 98, scale: 0.63, color: 'accentSoft' },
  { dx: 88, dy: 1, size: 9, radius: 999, delay: 330, duration: 870, rotate: 89, scale: 0.67, color: 'onPrimary' },
  { dx: 118, dy: 56, size: 6, radius: 2, delay: 440, duration: 1090, rotate: -177, scale: 0.93, color: 'onPrimary' },
  { dx: 83, dy: 37, size: 6, radius: 2, delay: 500, duration: 970, rotate: -148, scale: 0.95, color: 'cardShapeLighter' },
  { dx: 73, dy: 44, size: 12, radius: 999, delay: 320, duration: 780, rotate: 148, scale: 0.92, color: 'onPrimary' },
  { dx: 87, dy: 122, size: 8, radius: 999, delay: 580, duration: 980, rotate: -76, scale: 0.65, color: 'onPrimary' },
  { dx: 48, dy: 133, size: 12, radius: 4, delay: 510, duration: 730, rotate: 62, scale: 0.85, color: 'onPrimary' },
  { dx: 43, dy: 101, size: 6, radius: 2, delay: 330, duration: 920, rotate: -40, scale: 0.8, color: 'onPrimary' },
  { dx: -23, dy: 113, size: 9, radius: 999, delay: 330, duration: 810, rotate: 156, scale: 1, color: 'accent' },
  { dx: -50, dy: 83, size: 10, radius: 3, delay: 590, duration: 810, rotate: -3, scale: 1.13, color: 'onPrimary' },
  { dx: -23, dy: 103, size: 7, radius: 2, delay: 470, duration: 790, rotate: -53, scale: 0.68, color: 'onPrimary' },
  { dx: -103, dy: 112, size: 9, radius: 999, delay: 460, duration: 920, rotate: -130, scale: 1.09, color: 'accentSoft' },
  { dx: -85, dy: 72, size: 8, radius: 2, delay: 430, duration: 790, rotate: -158, scale: 0.71, color: 'onPrimary' },
  { dx: -77, dy: 21, size: 14, radius: 4, delay: 390, duration: 700, rotate: 14, scale: 0.92, color: 'accentSoft' },
  { dx: -168, dy: 24, size: 12, radius: 4, delay: 630, duration: 960, rotate: 178, scale: 0.63, color: 'cardShapeLighter' },
  { dx: -115, dy: -21, size: 9, radius: 3, delay: 470, duration: 860, rotate: -103, scale: 0.64, color: 'onPrimary' },
  { dx: -89, dy: -13, size: 10, radius: 999, delay: 300, duration: 760, rotate: -149, scale: 1.17, color: 'accentSoft' },
  { dx: -162, dy: -12, size: 10, radius: 3, delay: 520, duration: 1080, rotate: 108, scale: 0.82, color: 'accent' },
  { dx: -118, dy: -38, size: 9, radius: 3, delay: 410, duration: 760, rotate: 183, scale: 0.81, color: 'onPrimary' },
  { dx: -99, dy: -91, size: 10, radius: 999, delay: 630, duration: 910, rotate: -125, scale: 1.01, color: 'accent' },
  { dx: -36, dy: -87, size: 12, radius: 4, delay: 540, duration: 800, rotate: -13, scale: 1.14, color: 'onPrimary' },
  { dx: -16, dy: -110, size: 14, radius: 4, delay: 520, duration: 950, rotate: 188, scale: 1.11, color: 'onPrimary' },
  { dx: 18, dy: -127, size: 7, radius: 999, delay: 470, duration: 990, rotate: -186, scale: 1.07, color: 'accent' },
  { dx: -9, dy: -124, size: 8, radius: 2, delay: 630, duration: 1100, rotate: -14, scale: 0.65, color: 'accent' },
  { dx: 12, dy: -83, size: 7, radius: 2, delay: 640, duration: 940, rotate: -200, scale: 0.89, color: 'cardShapeLighter' },
  { dx: 57, dy: -110, size: 14, radius: 4, delay: 620, duration: 1010, rotate: 184, scale: 0.72, color: 'onPrimary' },
  { dx: 89, dy: -92, size: 6, radius: 2, delay: 640, duration: 860, rotate: 5, scale: 1.05, color: 'accent' },
  { dx: 86, dy: -37, size: 7, radius: 999, delay: 510, duration: 890, rotate: 135, scale: 0.69, color: 'accentSoft' },
  { dx: 142, dy: -10, size: 8, radius: 999, delay: 490, duration: 710, rotate: 171, scale: 0.99, color: 'accentSoft' },
  { dx: 93, dy: -3, size: 14, radius: 999, delay: 610, duration: 710, rotate: -92, scale: 0.78, color: 'onPrimary' },
];

/** `ls-burst`: fades in by 15 %, flies to (dx, dy) while it scales and turns, fades out after 70 %. */
function BurstBit({ bit }: { bit: Bit }) {
  const { colors } = useTheme();
  const move = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    const { delay, duration } = bit;
    move.value = withDelay(delay, withTiming(1, { duration, easing: BURST_EASE }));
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: duration * 0.15 }),
        withTiming(1, { duration: duration * 0.55 }),
        withTiming(0, { duration: duration * 0.3 }),
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
  return (
    <Animated.View
      style={[
        styles.bit,
        {
          width: bit.size,
          height: bit.size,
          marginLeft: -bit.size / 2,
          marginTop: -bit.size / 2,
          borderRadius: bit.radius,
          backgroundColor: colors[bit.color],
        },
        animated,
      ]}
    />
  );
}

interface Spark {
  /** Offset of its top left corner from the center of the check (the design's margins). */
  top: number;
  left: number;
  size: number;
  delay: number;
  /** Length of one twinkle. */
  period: number;
  shape: 'star' | 'square';
  color: BitColor;
}

// prettier-ignore
const SPARKS: readonly Spark[] = [
  { top: -64, left: -104, size: 24, delay: 900, period: 2600, shape: 'star', color: 'onPrimary' },
  { top: -72, left: 80, size: 28, delay: 1050, period: 3000, shape: 'star', color: 'onPrimary' },
  { top: 24, left: 104, size: 16, delay: 1150, period: 2400, shape: 'star', color: 'accentSoft' },
  { top: 16, left: -120, size: 14, delay: 1200, period: 2800, shape: 'star', color: 'accentSoft' },
  { top: -96, left: -72, size: 10, delay: 1000, period: 2200, shape: 'square', color: 'accent' },
  { top: -104, left: 48, size: 8, delay: 1100, period: 2600, shape: 'square', color: 'onPrimary' },
  { top: -24, left: -136, size: 9, delay: 1250, period: 3100, shape: 'square', color: 'onPrimary' },
  { top: -24, left: 136, size: 8, delay: 1300, period: 2500, shape: 'square', color: 'accent' },
];

/** `ls-spark-in` (0.5 s pop from −90°), then `ls-tw` forever: down to 50 % and 0.72, turned 20°. */
function SparkView({ spark }: { spark: Spark }) {
  const { colors } = useTheme();
  const pop = useSharedValue(0);
  const twinkle = useSharedValue(0);
  useEffect(() => {
    pop.value = withDelay(spark.delay, withTiming(1, { duration: 500, easing: POP_EASE }));
    twinkle.value = withDelay(
      spark.delay + 500,
      withRepeat(
        withTiming(1, { duration: spark.period / 2, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
    return () => {
      cancelAnimation(pop);
      cancelAnimation(twinkle);
    };
  }, [pop, spark, twinkle]);
  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(pop.value * 1.5, 1) * (1 - 0.5 * twinkle.value),
    transform: [
      { scale: pop.value * (1 - 0.28 * twinkle.value) },
      { rotate: `${-90 * (1 - pop.value) + 20 * twinkle.value}deg` },
    ],
  }));
  const color = colors[spark.color];
  return (
    <Animated.View
      style={[
        styles.bit,
        { marginTop: spark.top, marginLeft: spark.left, width: spark.size, height: spark.size },
        spark.shape === 'square'
          ? {
              borderRadius: spark.size > 8 ? 3 : 2,
              backgroundColor: color,
              transform: [{ rotate: '20deg' }],
            }
          : null,
        animated,
      ]}
    >
      {spark.shape === 'star' ? (
        <Svg width={spark.size} height={spark.size} viewBox="-12 -12 24 24">
          <Path d={STAR} fill={color} />
        </Svg>
      ) : null}
    </Animated.View>
  );
}

/** The bits and sparks around the 120 px check. Placed in a box of the check's size. */
export function ListoBurst() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="onboarding.listo.burst">
      {BITS.map((bit, i) => (
        <BurstBit key={i} bit={bit} />
      ))}
      {SPARKS.map((spark, i) => (
        <SparkView key={i} spark={spark} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bit: { position: 'absolute', left: '50%', top: '50%' },
});
