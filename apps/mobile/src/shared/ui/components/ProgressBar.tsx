// Lime bar on a light grey track (goal cards of VerdeDashboard: 6 px, fully rounded).
import { StyleSheet, View } from 'react-native';

import { colors, radius } from '../tokens';

export interface ProgressBarProps {
  /** 0 to 1. Values outside are clamped. */
  progress: number;
  height?: number;
  accessibilityLabel?: string;
}

export function ProgressBar({ progress, height = 6, accessibilityLabel }: ProgressBarProps) {
  const value = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const percent = Math.round(value * 100);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={[styles.track, { height }]}
    >
      <View style={[styles.fill, { width: `${percent}%`, height }]} testID="progress-fill" />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.divider, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { backgroundColor: colors.accent, borderRadius: radius.pill },
});
