// Page dots under a swipeable card (Detalle de cuenta, "1 de 4"): 7 px dots 8 px apart, the
// current one 22 px wide in the page color, the others half white. Width and color change over
// .25 s ease. Each dot is a button, so the person can change page without swiping.
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme, useThemedStyles, type Theme } from '../theme';
import { motion, radius } from '../tokens';

export interface PageDotsProps {
  /** One accessibility label per page, e.g. "Ver Banco Demo". */
  labels: string[];
  index: number;
  onSelect: (index: number) => void;
  testID?: string;
}

const DOT = 7;
const ACTIVE_WIDTH = 22;

function Dot({
  active,
  label,
  onPress,
  testID,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    const to = active ? 1 : 0;
    progress.value = reduceMotion
      ? to
      : withTiming(to, { duration: motion.slow, easing: Easing.ease });
  }, [active, reduceMotion, progress]);

  const idle = colors.onPrimaryDot;
  const current = colors.background;
  const animated = useAnimatedStyle(() => ({
    width: DOT + (ACTIVE_WIDTH - DOT) * progress.value,
    backgroundColor: interpolateColor(progress.value, [0, 1], [idle, current]),
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      hitSlop={10}
      testID={testID}
    >
      <Animated.View style={[styles.dot, animated]} />
    </Pressable>
  );
}

export function PageDots({ labels, index, onSelect, testID }: PageDotsProps) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.row} testID={testID}>
      {labels.map((label, i) => (
        <Dot
          key={`${i}-${label}`}
          active={i === index}
          label={label}
          onPress={() => onSelect(i)}
          testID={testID ? `${testID}-${i}` : undefined}
        />
      ))}
    </View>
  );
}

const createStyles = (_theme: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    dot: { height: DOT, borderRadius: radius.pill },
  });
