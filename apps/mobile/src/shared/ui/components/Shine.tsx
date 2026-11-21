// The diagonal light that sweeps over blue cards and headers in the design:
// `@keyframes shine { 0%, 62% { x: 0 } 86%, 100% { x: distance } }`, 7 s ease-in-out, 1.5 s delay.
// Turned off when the user asked the system to reduce motion.
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
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

import { useThemedStyles, type Theme } from '../theme';
import { motion } from '../tokens';

export interface ShineProps {
  /** How far the light travels, the width of the card plus its own width. */
  distance: number;
  height: number;
  width?: number;
  opacity?: number;
}

export function Shine({ distance, height, width = 46, opacity = 0.18 }: ShineProps) {
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const x = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return undefined;
    const total = motion.shine;
    x.value = withDelay(
      motion.shineDelay,
      withRepeat(
        withSequence(
          withTiming(0, { duration: total * 0.62 }),
          withTiming(distance, { duration: total * 0.24, easing: Easing.inOut(Easing.ease) }),
          withTiming(distance, { duration: total * 0.14 }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(x);
  }, [distance, reduceMotion, x]);

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { skewX: '-18deg' }],
  }));

  if (reduceMotion) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.light, { width, height, opacity, left: -width * 2.5 }, animated]}
    />
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    light: { position: 'absolute', top: -40, backgroundColor: colors.onPrimary },
  });
