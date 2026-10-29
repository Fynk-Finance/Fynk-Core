// Toggle of Movimientos, Ajustes de notificaciones, Privacidad and Seguridad (`.sw`): a 48 by 28
// track, blue when on and grey when off, with a 22 px knob that slides 20 px. The knob moves with
// `transform .2s cubic-bezier(.34,1.56,.64,1)` and the track color with `.2s ease`. Both are still
// with Reduce Motion. The knob is the page color: white in light, #13212D in dark.
import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme, useThemedStyles, type Theme } from '../theme';
import { motion, radius, size } from '../tokens';

export interface SwitchProps {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Required: what the switch turns on, e.g. "Recordatorio de pagos". */
  accessibilityLabel: string;
  disabled?: boolean;
  testID?: string;
}

const TRAVEL = size.switchWidth - size.switchKnob - 6;

export function Switch({
  value,
  onValueChange,
  accessibilityLabel,
  disabled = false,
  testID,
}: SwitchProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const knob = useSharedValue(value ? 1 : 0);
  const track = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    const to = value ? 1 : 0;
    if (reduceMotion) {
      knob.value = to;
      track.value = to;
      return;
    }
    knob.value = withTiming(to, {
      duration: motion.base,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    });
    track.value = withTiming(to, { duration: motion.base, easing: Easing.ease });
  }, [value, reduceMotion, knob, track]);

  const off = colors.trackOff;
  const on = colors.primary;
  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(track.value, [0, 1], [off, on]),
  }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: knob.value * TRAVEL }] }));

  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      hitSlop={8}
      testID={testID}
    >
      <Animated.View style={[styles.track, disabled ? styles.disabled : null, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    track: {
      width: size.switchWidth,
      height: size.switchHeight,
      borderRadius: radius.pill,
    },
    knob: {
      position: 'absolute',
      left: 3,
      top: 3,
      width: size.switchKnob,
      height: size.switchKnob,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3,
      elevation: 2,
    },
    disabled: { opacity: 0.5 },
  });
