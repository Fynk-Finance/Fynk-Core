// Line chart of VerdeInversion: a 2.5 px line without axes or grid, and a lime dot with a
// white ring on the last point. Built on react-native-gifted-charts.
import { StyleSheet, View } from 'react-native';
import { LineChart as GiftedLineChart } from 'react-native-gifted-charts';

import { colors } from '../tokens';

export interface LineChartProps {
  values: number[];
  width: number;
  height?: number;
  color?: string;
  /** Required: the chart is an image for screen readers. */
  accessibilityLabel: string;
}

const DOT = 12;

function EndDot() {
  return <View style={styles.dot} testID="line-chart-end-dot" />;
}

export function LineChart({
  values,
  width,
  height = 120,
  color = colors.white,
  accessibilityLabel,
}: LineChartProps) {
  const finite = values.filter((v) => Number.isFinite(v));
  const min = finite.length ? Math.min(...finite) : 0;
  const max = finite.length ? Math.max(...finite) : 1;
  const span = max - min || 1;
  // Keep the line inside the box: 12 % room above and below, like the design.
  const offset = min - span * 0.12;
  const data = finite.map((value, i) => ({
    value,
    hideDataPoint: i !== finite.length - 1,
    customDataPoint: i === finite.length - 1 ? EndDot : undefined,
  }));

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ width, height }}
    >
      <GiftedLineChart
        data={data}
        width={width}
        height={height}
        initialSpacing={0}
        endSpacing={DOT / 2}
        spacing={finite.length > 1 ? (width - DOT / 2) / (finite.length - 1) : width}
        thickness={2.5}
        color={color}
        yAxisOffset={offset}
        maxValue={span * 1.24}
        hideRules
        hideYAxisText
        yAxisLabelWidth={0}
        yAxisThickness={0}
        xAxisThickness={0}
        disableScroll
        isAnimated={false}
        // The chart schedules its width timers even when not animated; this makes them immediate.
        animateTogether
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.accent,
    borderWidth: 2.5,
    borderColor: colors.white,
  },
});
