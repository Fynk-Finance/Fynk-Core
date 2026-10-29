// Two bank cards and two coin stacks of the Inicio screen. Paths, viewBox and colors are
// copied from docs/design/sources/light/Inicio.html and docs/design/sources/dark/Inicio.html
// (screen illustration colors stay in the module, see docs/design/README.md). Only the backdrop,
// the card shadow and the blue card's second logo square differ between themes. The looping
// motion (fk-float, fk-shadow, fk-shine, fk-drop, fk-twinkle, see inicioMotion.ts) runs on one
// layer per moving group, each layer an Svg with the same viewBox, so the transforms apply in
// view space. With reduced motion the resting frame is drawn as a single Svg and nothing is
// started.
import { useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';
import Svg, { ClipPath, Defs, Ellipse, G, Path, Rect, Text } from 'react-native-svg';

import { fonts, useTheme, type ColorScheme } from '@shared/ui';

import {
  DROP,
  FLOAT,
  SHADOW_OPACITY,
  SHADOW_SCALE,
  SHINE,
  TWINKLE_OPACITY,
  TWINKLE_SCALE,
  sampleKeyframes,
  useLoopPhase,
} from './inicioMotion';
import { identityStrings } from './strings.es-CO';

interface CardColors {
  base: string;
  shapeA: string;
  shapeB: string;
  chip: string;
  chipLines: string;
  nameBar: string;
  numberBar: string;
  logoA: string;
  /** The only card color that changes with the theme. */
  logoB: Record<ColorScheme, string>;
}

const LIME: CardColors = {
  base: '#a8e03a',
  shapeA: '#b5e654',
  shapeB: '#c3e877',
  chip: '#f4fbe3',
  chipLines: '#d2f09a',
  nameBar: '#d2f09a',
  numberBar: '#c3e877',
  logoA: '#dcf5a8',
  logoB: { light: '#f8fdee', dark: '#f8fdee' },
};

const BLUE: CardColors = {
  base: '#50c1eb',
  shapeA: '#6bccef',
  shapeB: '#86d6f3',
  chip: '#e6f7fd',
  chipLines: '#a9e0f5',
  nameBar: '#a9e0f5',
  numberBar: '#86d6f3',
  logoA: '#b5e5f7',
  logoB: { light: '#eef9fe', dark: '#182a37' },
};

// Colors of the picture that differ between docs/design/sources/light and dark/Inicio.html.
const ILLUSTRATION: Record<
  ColorScheme,
  { backdropOuter: string; backdropInner: string; cardShadow: string }
> = {
  light: { backdropOuter: '#f4fbfe', backdropInner: '#e4f5fc', cardShadow: '#d2eef9' },
  dark: { backdropOuter: '#182a37', backdropInner: '#1a3444', cardShadow: '#1d3a4a' },
};

function Card({ c, children }: { c: CardColors; children?: ReactNode }) {
  const { scheme } = useTheme();
  return (
    <G clipPath="url(#fk-card-clip)">
      <Rect x={0} y={0} width={220} height={138} rx={18} fill={c.base} />
      <Rect x={132} y={-70} width={140} height={140} rx={30} fill={c.shapeA} />
      <Rect x={182} y={-30} width={80} height={80} rx={18} fill={c.shapeB} />
      <Rect x={22} y={40} width={36} height={27} rx={6} fill={c.chip} />
      <Path
        d="M22 53.5h36M40 40v27M31 40v6M49 40v6M31 61v6M49 61v6"
        stroke={c.chipLines}
        strokeWidth={1.5}
        fill="none"
      />
      <Path
        d="M70 46.5a10 10 0 0 1 0 14M76 42.5a16 16 0 0 1 0 22"
        stroke={c.chip}
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
      />
      <Rect x={22} y={94} width={112} height={8} rx={4} fill={c.nameBar} />
      <Rect x={22} y={110} width={58} height={6} rx={3} fill={c.numberBar} />
      <Rect x={156} y={95} width={26} height={26} rx={6} fill={c.logoA} />
      <Rect x={174} y={95} width={26} height={26} rx={6} fill={c.logoB[scheme]} fillOpacity={0.9} />
      {children}
    </G>
  );
}

/** One coin: side, rim and face. (cx, cy) is the top face; `large` for the right stack. */
function Coin({ cx, cy, large }: { cx: number; cy: number; large: boolean }) {
  const rx = large ? 32 : 26;
  const ry = large ? 10 : 8;
  const h = large ? 9 : 8;
  return (
    <>
      <Ellipse cx={cx} cy={cy + h} rx={rx} ry={ry} fill="#8fc426" />
      <Rect x={cx - rx} y={cy} width={rx * 2} height={h} fill="#a8e03a" />
      <Ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#f4fbe3" stroke="#a8e03a" strokeWidth={2} />
      <Ellipse
        cx={cx}
        cy={cy}
        rx={large ? 21.8 : 17.7}
        ry={large ? 6.8 : 5.4}
        fill="none"
        stroke="#d2f09a"
        strokeWidth={1.6}
      />
    </>
  );
}

function Dollar({ x, y }: { x: number; y: number }) {
  return (
    <G transform={`translate(${x} ${y}) scale(1 .42)`}>
      <Text
        x={0}
        y={7}
        textAnchor="middle"
        fontFamily={fonts.heading.bold}
        fontWeight="700"
        fontSize={22}
        fill="#6a9e12"
      >
        $
      </Text>
    </G>
  );
}

const VIEW_BOX = { x: 16, y: 12, width: 310, height: 331 };
const VIEW_BOX_ATTR = `${VIEW_BOX.x} ${VIEW_BOX.y} ${VIEW_BOX.width} ${VIEW_BOX.height}`;
const CENTER = { x: VIEW_BOX.x + VIEW_BOX.width / 2, y: VIEW_BOX.y + VIEW_BOX.height / 2 };

const FLOAT_MS = 6000; // fk-float, fk-shadow and fk-shine run 6 s
const DROP_MS = 5000; // fk-drop runs 5 s

interface CardSpec {
  colors: CardColors;
  angle: number;
  pivot: [number, number];
  offset: [number, number];
  floatDelay: number;
  shineDelay: number;
}

// Lime card behind (.card-b), blue card in front (.card) of the design.
const CARDS: CardSpec[] = [
  {
    colors: LIME,
    angle: -20,
    pivot: [50, 80],
    offset: [47, 60],
    floatDelay: -1400,
    shineDelay: 2400,
  },
  {
    colors: BLUE,
    angle: -8,
    pivot: [171, 176],
    offset: [61, 107],
    floatDelay: 0,
    shineDelay: 1000,
  },
];

interface SparkSpec {
  d: string;
  fill: string;
  /** Center of the sparkle's own box, the origin of its scale. */
  center: [number, number];
  durationMs: number;
  delayMs: number;
}

const SPARKS: SparkSpec[] = [
  {
    d: 'M48 170l3 7 7 3-7 3-3 7-3-7-7-3 7-3z',
    fill: '#7fd3f2',
    center: [48, 180],
    durationMs: 3200,
    delayMs: 0,
  },
  {
    d: 'M214 50l2.4 5.6 5.6 2.4-5.6 2.4-2.4 5.6-2.4-5.6-5.6-2.4 5.6-2.4z',
    fill: '#b9e862',
    center: [214, 58],
    durationMs: 3800,
    delayMs: -1200,
  },
  {
    d: 'M306 176l2 4.6 4.6 2-4.6 2-2 4.6-2-4.6-4.6-2 4.6-2z',
    fill: '#d2f09a',
    center: [306, 182.6],
    durationMs: 4400,
    delayMs: -2200,
  },
];

function Backdrop() {
  const { scheme } = useTheme();
  return (
    <>
      <Rect
        x={21}
        y={28}
        width={300}
        height={300}
        rx={64}
        fill={ILLUSTRATION[scheme].backdropOuter}
      />
      <Rect
        x={65}
        y={72}
        width={212}
        height={212}
        rx={44}
        fill={ILLUSTRATION[scheme].backdropInner}
      />
    </>
  );
}

function CardShadow() {
  const { scheme } = useTheme();
  return <Ellipse cx={171} cy={300} rx={92} ry={9} fill={ILLUSTRATION[scheme].cardShadow} />;
}

function CardPlacement({ spec, children }: { spec: CardSpec; children: ReactNode }) {
  return (
    <G transform="translate(20 0)">
      <G transform={`rotate(${spec.angle} ${spec.pivot[0]} ${spec.pivot[1]})`}>
        <G transform={`translate(${spec.offset[0]} ${spec.offset[1]})`}>{children}</G>
      </G>
    </G>
  );
}

function StackLeftBase() {
  return (
    <>
      <Ellipse cx={90} cy={302} rx={36} ry={7} fill="#e8f7cc" />
      <Coin cx={90} cy={292} large={false} />
      <Coin cx={92} cy={284} large={false} />
    </>
  );
}

function StackLeftTop() {
  return (
    <>
      <Coin cx={89} cy={276} large={false} />
      <Dollar x={89} y={276} />
    </>
  );
}

function StackRightBase() {
  return (
    <>
      <Ellipse cx={258} cy={310} rx={42} ry={9} fill="#e8f7cc" />
      <Coin cx={258} cy={299} large />
      <Coin cx={261} cy={290} large />
      <Coin cx={256} cy={281} large />
      <Coin cx={260} cy={272} large />
      <Coin cx={257} cy={263} large />
    </>
  );
}

function StackRightTop() {
  return (
    <>
      <Coin cx={259} cy={254} large />
      <Dollar x={259} y={254} />
    </>
  );
}

/** The resting frame, also what reduced motion shows. */
function StaticArt() {
  return (
    <>
      <Backdrop />
      <CardShadow />
      {CARDS.map((spec) => (
        <CardPlacement key={spec.colors.base} spec={spec}>
          <Card c={spec.colors} />
        </CardPlacement>
      ))}
      <StackLeftBase />
      <StackLeftTop />
      <StackRightBase />
      <StackRightTop />
      {SPARKS.map((s) => (
        <Path key={s.d} d={s.d} fill={s.fill} />
      ))}
    </>
  );
}

function ArtSvg({ children }: { children: ReactNode }) {
  return (
    <Svg width="100%" height="100%" viewBox={VIEW_BOX_ATTR}>
      <Defs>
        <ClipPath id="fk-card-clip">
          <Rect x={0} y={0} width={220} height={138} rx={18} />
        </ClipPath>
      </Defs>
      {children}
    </Svg>
  );
}

function Layer({
  name,
  style,
  children,
}: {
  name: string;
  style: ComponentProps<typeof Animated.View>['style'];
  children: ReactNode;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
      testID={`identity.inicio.illustration.layer.${name}`}
    >
      <ArtSvg>{children}</ArtSvg>
    </Animated.View>
  );
}

/** A layer that does not move. Every layer fills the box, so they stack in drawing order. */
function Still({ children }: { children: ReactNode }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <ArtSvg>{children}</ArtSvg>
    </View>
  );
}

/** Offset of a point from the middle of the picture, in points, for a layer pivot. */
function pivotOf(x: number, y: number, scale: number) {
  return { x: (x - CENTER.x) * scale, y: (y - CENTER.y) * scale };
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

// fk-float moves the card along its own (rotated) vertical axis; fk-shine slides a skewed light
// across it, clipped by the card.
function CardLayer({ spec, scale }: { spec: CardSpec; scale: number }) {
  const float = useLoopPhase(FLOAT_MS, spec.floatDelay);
  const shine = useLoopPhase(FLOAT_MS, spec.shineDelay);
  const rad = (spec.angle * Math.PI) / 180;
  const style = useAnimatedStyle(() => {
    const v = sampleKeyframes(FLOAT, float.value) * scale;
    return {
      transform: [{ translateX: -v * Math.sin(rad) }, { translateY: v * Math.cos(rad) }],
    };
  });
  const lightProps = useAnimatedProps(() => ({ x: -70 + sampleKeyframes(SHINE, shine.value) }));
  return (
    <Layer name={`card-${spec.angle}`} style={style}>
      <CardPlacement spec={spec}>
        <Card c={spec.colors}>
          <AnimatedRect
            animatedProps={lightProps}
            x={-70}
            y={-30}
            width={34}
            height={200}
            fill="#ffffff"
            fillOpacity={0.3}
            transform="translate(-53 70) skewX(-18) translate(53 -70)"
          />
        </Card>
      </CardPlacement>
    </Layer>
  );
}

function ShadowLayer({ scale }: { scale: number }) {
  const phase = useLoopPhase(FLOAT_MS, 0);
  const pivot = pivotOf(171, 300, scale);
  const style = useAnimatedStyle(() => ({
    opacity: sampleKeyframes(SHADOW_OPACITY, phase.value),
    transform: [
      { translateX: pivot.x },
      { translateY: pivot.y },
      { scaleX: sampleKeyframes(SHADOW_SCALE, phase.value) },
      { translateX: -pivot.x },
      { translateY: -pivot.y },
    ],
  }));
  return (
    <Layer name="shadow" style={style}>
      <CardShadow />
    </Layer>
  );
}

function DropLayer({
  name,
  delayMs,
  scale,
  children,
}: {
  name: string;
  delayMs: number;
  scale: number;
  children: ReactNode;
}) {
  const phase = useLoopPhase(DROP_MS, delayMs);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: sampleKeyframes(DROP, phase.value) * scale }],
  }));
  return (
    <Layer name={name} style={style}>
      {children}
    </Layer>
  );
}

function SparkLayer({ spec, scale }: { spec: SparkSpec; scale: number }) {
  const phase = useLoopPhase(spec.durationMs, spec.delayMs);
  const pivot = pivotOf(spec.center[0], spec.center[1], scale);
  const style = useAnimatedStyle(() => ({
    opacity: sampleKeyframes(TWINKLE_OPACITY, phase.value),
    transform: [
      { translateX: pivot.x },
      { translateY: pivot.y },
      { scale: sampleKeyframes(TWINKLE_SCALE, phase.value) },
      { translateX: -pivot.x },
      { translateY: -pivot.y },
    ],
  }));
  return (
    <Layer name={`spark-${spec.delayMs}`} style={style}>
      <Path d={spec.d} fill={spec.fill} />
    </Layer>
  );
}

/** The animated picture: a still backdrop and one layer per moving group, same viewBox. */
function MotionArt({ scale }: { scale: number }) {
  return (
    <>
      <Still>
        <Backdrop />
      </Still>
      <ShadowLayer scale={scale} />
      {CARDS.map((spec) => (
        <CardLayer key={spec.colors.base} spec={spec} scale={scale} />
      ))}
      <Still>
        <StackLeftBase />
        <StackRightBase />
      </Still>
      <DropLayer name="drop-left" delayMs={3700} scale={scale}>
        <StackLeftTop />
      </DropLayer>
      <DropLayer name="drop-right" delayMs={1200} scale={scale}>
        <StackRightTop />
      </DropLayer>
      {SPARKS.map((spec) => (
        <SparkLayer key={spec.d} spec={spec} scale={scale} />
      ))}
    </>
  );
}

export function InicioIllustration() {
  const reduceMotion = useReducedMotion();
  const [scale, setScale] = useState<number | null>(null);

  // Layers move in points and the drawing is in viewBox units, so the layers need the
  // meet-fit scale of the box the Svg is drawn in.
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setScale(Math.min(width / VIEW_BOX.width, height / VIEW_BOX.height));
  };

  return (
    <View
      style={styles.fill}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={identityStrings.inicio.illustration}
      testID="identity.inicio.illustration"
    >
      {!reduceMotion && scale !== null && scale > 0 ? (
        <MotionArt scale={scale} />
      ) : (
        <ArtSvg>
          <StaticArt />
        </ArtSvg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
