// fk-rise of VerdeInicio: fade in while moving up 12 px, 0.7 s ease-out, after a delay.
// Shown at rest when reduced motion is on.
import { useEffect, type ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

const DURATION_MS = 700;
const OFFSET = 12;

export function Rise({
  delay,
  children,
  style,
}: {
  delay: number;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: DURATION_MS, easing: Easing.out(Easing.ease) }),
    );
  }, [delay, progress, reduceMotion]);
  const animated = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * OFFSET }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}
