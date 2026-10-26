// Donut of VerdeRecomendaciones and VerdeInversion: a light blue track and one rounded arc per
// segment, separated by a gap, starting at 12 o'clock. Drawn with react-native-svg because the
// design's rounded, separated arcs are not something react-native-gifted-charts' pie can draw.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, type ColorToken } from '../tokens';

export interface DonutSegment {
  value: number;
  color: ColorToken;
}

export interface DonutProps {
  segments: DonutSegment[];
  /** 140 in Recomendaciones, 104 in Inversión. */
  size?: number;
  /** Ring radius. The design uses 54 for 140 and 40 for 104. */
  radius?: number;
  strokeWidth?: number;
  /** Arc length left between segments. */
  gap?: number;
  /** Required: the donut is an image for screen readers. */
  accessibilityLabel: string;
  /** Centered content, e.g. the total. */
  children?: ReactNode;
}

export interface Arc {
  length: number;
  offset: number;
  color: ColorToken;
}

/** Arc lengths and offsets along the circle, in the order of the segments. */
export function donutArcs(segments: DonutSegment[], circumference: number, gap: number): Arc[] {
  const visible = segments.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return [];
  const available = Math.max(0, circumference - gap * visible.length);
  let cursor = gap / 2;
  return visible.map((s) => {
    const length = (available * s.value) / total;
    const arc = { length, offset: -cursor, color: s.color };
    cursor += length + gap;
    return arc;
  });
}

export function Donut({
  segments,
  size = 140,
  radius,
  strokeWidth = 14,
  gap = strokeWidth,
  accessibilityLabel,
  children,
}: DonutProps) {
  const r = radius ?? size / 2 - strokeWidth;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const arcs = donutArcs(segments, circumference, gap);
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={colors.surfaceBlue}
          strokeWidth={strokeWidth}
        />
        {arcs.map((a, i) => (
          <Circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={colors[a.color]}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${a.length.toFixed(1)} ${circumference.toFixed(1)}`}
            strokeDashoffset={a.offset.toFixed(1)}
            transform={`rotate(-90 ${c} ${c})`}
          />
        ))}
      </Svg>
      {children ? <View style={styles.center}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
});
