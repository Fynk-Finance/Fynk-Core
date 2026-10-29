// Floating action button. Round on the Dashboard ("Registrar gasto o ingreso", 64 by 64, plus
// icon 32 px with stroke 2.8) and extended on Metas ("Nueva meta", 64 high, icon 24 px, 15 px
// bold label). Blue with radius 20 and a blue shadow, the same in both themes. When it opens a
// menu, the plus turns 45 degrees into a close mark (`.fab-ic`, .25 s ease). The screen places it.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '../icons';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { fonts, motion, size } from '../tokens';

export interface FabProps {
  onPress: () => void;
  /** Required: what it does, e.g. "Registrar gasto o ingreso". */
  accessibilityLabel: string;
  /** Extended button with this text, e.g. "Nueva meta". */
  label?: string;
  /** The menu it opens is showing: the plus turns into a close mark. */
  expanded?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const FAB_RADIUS = 20;

export function Fab({ onPress, accessibilityLabel, label, expanded, style, testID }: FabProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(expanded ? 1 : 0);

  useEffect(() => {
    const to = expanded ? 1 : 0;
    turn.value = reduceMotion ? to : withTiming(to, { duration: motion.slow, easing: Easing.ease });
  }, [expanded, reduceMotion, turn]);

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 45}deg` }] }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      testID={testID}
      style={({ pressed }) => [
        styles.fab,
        label ? styles.extended : styles.round,
        { backgroundColor: pressed ? colors.primaryPressed : colors.primary },
        style,
      ]}
    >
      <Animated.View style={iconStyle}>
        <Icon name="plus" size={label ? 24 : 32} strokeWidth={2.8} color={colors.onPrimary} />
      </Animated.View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    fab: {
      height: size.fab,
      borderRadius: FAB_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.fab,
    },
    round: { width: size.fab },
    extended: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
    label: { fontFamily: fonts.body.bold, fontSize: 15, color: colors.onPrimary },
  });
