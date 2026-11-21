// `ob-rise` of the onboarding design: content fades in while it rises 16 px (0.5 s ease-out,
// 0.05 s delay). Static when reduced motion is on.
import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export function useRise(distance = 16, duration = 500, delay = 50) {
  const reduceMotion = useReducedMotion();
  const shown = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    shown.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.ease) }));
  }, [delay, duration, reduceMotion, shown]);

  return useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [{ translateY: (1 - shown.value) * distance }],
  }));
}
