// Onboarding header of VerdeOnbNombre: back button, "Paso 1 de 5", "Omitir", and five segments
// on the blue header. The current segment fills with `pb-fill` (0.6 s, cubic-bezier(.65,0,.35,1),
// 0.15 s delay), off when reduced motion is on.
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { uiStrings } from '../strings.es-CO';
import { useThemedStyles, type Theme } from '../theme';
import { fonts, radius, size } from '../tokens';
import { AppText } from './AppText';
import { BackButton } from './BackButton';

export interface StepProgressProps {
  /** 1-based current step. */
  step: number;
  total?: number;
  onBack?: () => void;
  onSkip?: () => void;
}

function CurrentSegment() {
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    scale.value = withDelay(
      150,
      withTiming(1, { duration: 600, easing: Easing.bezier(0.65, 0, 0.35, 1) }),
    );
  }, [reduceMotion, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scaleX: scale.value }] }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.fill, styles.fromLeft, animated]} />
  );
}

export function StepProgress({ step, total = 5, onBack, onSkip }: StepProgressProps) {
  const styles = useThemedStyles(createStyles);
  const current = Math.min(total, Math.max(1, Math.round(step)));
  return (
    <View>
      <View style={styles.header}>
        {onBack ? <BackButton onPress={onBack} /> : <View style={styles.side} />}
        <AppText variant="smallStrong" color="onPrimary" style={styles.stepLabel}>
          {uiStrings.step(current, total)}
        </AppText>
        {onSkip ? (
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            style={({ pressed }) => [styles.skip, pressed ? styles.pressed : null]}
          >
            <AppText variant="label" color="onPrimary" style={styles.skipText}>
              {uiStrings.skip}
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.side} />
        )}
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={uiStrings.stepProgress}
        accessibilityValue={{ min: 1, max: total, now: current }}
        style={styles.segments}
      >
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={styles.segment} testID={`step-segment-${i + 1}`}>
            {i + 1 < current ? <View style={[StyleSheet.absoluteFill, styles.fill]} /> : null}
            {i + 1 === current ? <CurrentSegment /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: {
      height: size.backButton,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    side: { width: size.backButton },
    // "Paso 1 de 5": 13 px bold, letter-spacing .02em. "Omitir": 14 px bold.
    stepLabel: { fontFamily: fonts.body.bold, letterSpacing: 0.26 },
    skip: { minWidth: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
    skipText: { fontFamily: fonts.body.bold },
    pressed: { opacity: 0.7 },
    segments: { flexDirection: 'row', gap: 6, marginTop: 16 },
    segment: {
      flex: 1,
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: colors.onPrimaryTrack,
      overflow: 'hidden',
    },
    fill: { backgroundColor: colors.accent, borderRadius: radius.pill },
    fromLeft: { transformOrigin: 'left' },
  });
