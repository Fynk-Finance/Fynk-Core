// Illustration of Aviso (OnbIntro): the checklist card, the blue card, the target and the
// "+$625.000" pill. Paths, viewBox and colors are copied from docs/design/sources/light/OnbIntro.html
// and docs/design/sources/dark/OnbIntro.html (screen illustration colors stay in the module, see
// docs/design/README.md). In dark only the inner square, the pill and the empty bars change.
// Each floating group (`ob-float`, `ob-float2`) is its own Svg layer with the same viewBox, moved
// up and down; the stars twinkle (`ob-twinkle`). Nothing moves with reduced motion.
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect, Text } from 'react-native-svg';

import { fonts, useTheme } from '@shared/ui';

import { onboardingStrings } from './strings.es-CO';

const VIEW_W = 342;
const VIEW_H = 392;
/** Drawn at 366 × 420 in the design. */
export const ILLUSTRATION_WIDTH = 366;
export const ILLUSTRATION_HEIGHT = 420;
const K = ILLUSTRATION_WIDTH / VIEW_W;

const STAR = 'M0 -11C.6 -4 4 -.6 11 0 4 .6 .6 4 0 11 -.6 4 -4 .6 -11 0 -4 -.6 -.6 -4 0 -11Z';
const EASE = Easing.inOut(Easing.ease);

const PALETTE = {
  light: { innerOpacity: 1, pill: '#e4f5fc', bar: '#e8eef2', barEmpty: '#edf1f4' },
  dark: { innerOpacity: 0.4, pill: '#1a3444', bar: '#22313d', barEmpty: '#22313d' },
} as const;

/** `ob-float` (up 8) and `ob-float2` (down 6): ease-in-out loops, in view units. */
function useFloat(amplitude: number, duration: number, delay: number, still: boolean) {
  const y = useSharedValue(0);
  useEffect(() => {
    if (still) return undefined;
    const half = { duration: duration / 2, easing: EASE };
    y.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(amplitude * K, half), withTiming(0, half)), -1),
    );
    return () => cancelAnimation(y);
  }, [amplitude, delay, duration, still, y]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
}

function Layer({ children, style }: { children: ReactNode; style?: object }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg
        width={ILLUSTRATION_WIDTH}
        height={ILLUSTRATION_HEIGHT}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      >
        {children}
      </Svg>
    </Animated.View>
  );
}

/** A twinkling star (`ob-twinkle`, 2.6 s): opacity 1 → .55 and scale 1 → .8 and back. */
function Star(props: {
  x: number;
  y: number;
  scale: number;
  delay: number;
  opacity?: number;
  still: boolean;
}) {
  const { x, y, scale, delay, opacity = 1, still } = props;
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) return undefined;
    const half = { duration: 1300, easing: EASE };
    t.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, half), withTiming(0, half)), -1),
    );
    return () => cancelAnimation(t);
  }, [delay, still, t]);
  const animated = useAnimatedStyle(() => ({
    opacity: 1 - 0.45 * t.value,
    transform: [{ scale: 1 - 0.2 * t.value }],
  }));
  const size = 22 * scale * K;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.star,
        { left: x * K - size / 2, top: y * K - size / 2, width: size, height: size },
        animated,
      ]}
    >
      <Svg width={size} height={size} viewBox="-11 -11 22 22">
        <Path d={STAR} fill="#ffffff" fillOpacity={opacity} />
      </Svg>
    </Animated.View>
  );
}

function ChecklistCard({ bar, barEmpty, pill }: { bar: string; barEmpty: string; pill: string }) {
  const done = (y: number, w1: number, w2: number) => (
    <G key={y}>
      <Rect x={20} y={y} width={22} height={22} rx={8} fill="#a8e03a" />
      <Path
        d={`M25.5 ${y + 11}l4 4 7-7.5`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={52} y={y + 3} width={w1} height={7} rx={3.5} fill="#c9d6de" />
      <Rect x={52} y={y + 14} width={w2} height={5} rx={2.5} fill={bar} />
    </G>
  );
  const todo = (y: number, w1: number, w2: number) => (
    <G key={y}>
      <Rect x={20} y={y} width={22} height={22} rx={8} fill={barEmpty} />
      <Rect x={52} y={y + 3} width={w1} height={7} rx={3.5} fill="#dfe8ee" />
      <Rect x={52} y={y + 14} width={w2} height={5} rx={2.5} fill={bar} />
    </G>
  );
  return (
    <G>
      <Rect x={71} y={66} width={200} height={246} rx={28} fill="#1b8cba" fillOpacity={0.35} />
      <G transform="translate(71 56)">
        <Rect width={200} height={246} rx={28} fill="#ffffff" />
        <Rect x={20} y={22} width={92} height={10} rx={5} fill="#0f2233" fillOpacity={0.85} />
        <Rect x={148} y={18} width={32} height={18} rx={9} fill={pill} />
        <Rect x={155} y={25} width={18} height={4} rx={2} fill="#2fa8d8" />
        {done(52, 86, 58)}
        {done(88, 70, 92)}
        <Rect
          x={21.5}
          y={125.5}
          width={19}
          height={19}
          rx={7}
          fill="#ffffff"
          stroke="#2fa8d8"
          strokeWidth={3}
        />
        <Rect x={27} y={131} width={8} height={8} rx={3} fill="#2fa8d8" />
        <Rect x={52} y={127} width={96} height={7} rx={3.5} fill="#0f2233" fillOpacity={0.85} />
        <Rect x={52} y={138} width={64} height={5} rx={2.5} fill={bar} />
        {todo(160, 78, 50)}
        {todo(196, 90, 60)}
        <Rect x={20} y={226} width={160} height={7} rx={3.5} fill={barEmpty} />
        <Rect x={20} y={226} width={96} height={7} rx={3.5} fill="#a8e03a" />
      </G>
    </G>
  );
}

function BlueCard() {
  return (
    <G transform="translate(62 282) scale(.72) translate(-112 -115)">
      <G transform="rotate(-12 110 112)">
        <Defs>
          <ClipPath id="ob-card">
            <Rect x={20} y={58} width={184} height={114} rx={20} />
          </ClipPath>
        </Defs>
        <Rect x={20} y={58} width={184} height={114} rx={20} fill="#1f8fbd" />
        <G clipPath="url(#ob-card)">
          <Rect x={140} y={20} width={96} height={96} rx={24} fill="#2a9bc9" />
          <Rect x={168} y={40} width={54} height={54} rx={14} fill="#36a6d3" />
          <Rect x={0} y={140} width={64} height={64} rx={16} fill="#177fa9" />
        </G>
        <Rect x={38} y={78} width={48} height={7} rx={3.5} fill="#ffffff" fillOpacity={0.85} />
        <Rect x={38} y={94} width={104} height={14} rx={7} fill="#ffffff" />
        <Rect x={38} y={140} width={34} height={18} rx={7} fill="#ffffff" fillOpacity={0.3} />
        <Rect x={78} y={140} width={34} height={18} rx={7} fill="#ffffff" fillOpacity={0.3} />
      </G>
    </G>
  );
}

function TargetAndPill() {
  return (
    <G>
      <G transform="translate(274 66) scale(.9) translate(-282 -74)">
        <G transform="rotate(12 282 74)">
          <Rect x={248} y={40} width={68} height={68} rx={20} fill="#a8e03a" />
          <Circle cx={282} cy={74} r={20} fill="none" stroke="#ffffff" strokeWidth={4} />
          <Circle cx={282} cy={74} r={11} fill="none" stroke="#ffffff" strokeWidth={4} />
          <Circle cx={282} cy={74} r={3.5} fill="#ffffff" />
        </G>
      </G>
      <G transform="translate(-6 -44)">
        <Rect x={210} y={336} width={122} height={38} rx={19} fill="#ffffff" />
        <Rect x={218} y={343} width={24} height={24} rx={8} fill="#a8e03a" />
        <Path
          d="M225 357l5-5 4 3 5-6"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Text x={250} y={360} fontFamily={fonts.amount.semibold} fontSize={13} fill="#6a9e12">
          +$625.000
        </Text>
      </G>
    </G>
  );
}

export function IntroIllustration() {
  const { scheme, colors } = useTheme();
  const still = useReducedMotion();
  const palette = PALETTE[scheme];
  const card = useFloat(-8, 5000, 0, still);
  const blue = useFloat(6, 6000, 600, still);
  const target = useFloat(-8, 4400, 1200, still);

  return (
    <View
      style={styles.frame}
      accessible
      accessibilityRole="image"
      accessibilityLabel={onboardingStrings.intro.illustration}
    >
      <Layer>
        <Rect x={36} y={44} width={270} height={270} rx={64} fill={colors.onPrimaryOverlay} />
        <Rect
          x={88}
          y={96}
          width={166}
          height={166}
          rx={40}
          fill="#47b6e2"
          opacity={palette.innerOpacity}
        />
      </Layer>
      <Layer style={card}>
        <ChecklistCard bar={palette.bar} barEmpty={palette.barEmpty} pill={palette.pill} />
      </Layer>
      <Layer style={blue}>
        <BlueCard />
      </Layer>
      <Layer style={target}>
        <TargetAndPill />
      </Layer>
      <Star x={318} y={214} scale={1} delay={0} still={still} />
      <Star x={34} y={150} scale={0.6} delay={900} still={still} />
      <Star x={232} y={28} scale={0.45} delay={1600} opacity={0.85} still={still} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: ILLUSTRATION_WIDTH, height: ILLUSTRATION_HEIGHT },
  star: { position: 'absolute' },
});
