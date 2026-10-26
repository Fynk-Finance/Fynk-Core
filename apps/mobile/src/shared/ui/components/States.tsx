// Empty, error and loading states. The design has no screen for them, so they are built from
// its pieces: the 72 px warning tile of VerdeOnbOmitir, section titles, buttons and the divider
// color. New UI, needs design review.
import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { IconName } from '../icons';
import { uiStrings } from '../strings.es-CO';
import { colors, radius } from '../tokens';
import { AppText } from './AppText';
import { GhostButton, PrimaryButton } from './Button';
import { IconTile } from './IconTile';

export interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  title,
  message,
  icon = 'goal',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.state}>
      <IconTile icon={icon} tone="soft" size={72} />
      <AppText variant="section" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText variant="small" color="textSecondary" align="center">
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = uiStrings.errorTitle,
  message = uiStrings.errorMessage,
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.state} accessibilityLiveRegion="polite">
      <IconTile icon="warning" tone="danger" size={72} />
      <AppText variant="section" align="center">
        {title}
      </AppText>
      <AppText variant="small" color="textSecondary" align="center">
        {message}
      </AppText>
      {onRetry ? (
        <GhostButton label={uiStrings.retry} icon="sync" onPress={onRetry} style={styles.action} />
      ) : null}
    </View>
  );
}

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}

/** Placeholder block that pulses while data loads. Static when reduced motion is on. */
export function Skeleton({
  width = '100%',
  height = 16,
  radius: r = radius.tileSm,
}: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return undefined;
    opacity.value = withRepeat(
      withTiming(0.5, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity, reduceMotion]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.skeleton, { width, height, borderRadius: r }, animated]}
    />
  );
}

const styles = StyleSheet.create({
  state: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 12 },
  action: { marginTop: 8 },
  skeleton: { backgroundColor: colors.divider },
});
