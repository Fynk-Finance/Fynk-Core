// Empty, error and loading states, and the empty card of a section (GhostCard). The design has no screen for them, so they are built from
// its pieces: the 72 px warning tile of VerdeOnbOmitir, section titles, buttons and the divider
// color. New UI, needs design review.
import { useEffect } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type IconName } from '../icons';
import { uiStrings } from '../strings.es-CO';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { fonts, radius } from '../tokens';
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
  const styles = useThemedStyles(createStyles);
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
  const styles = useThemedStyles(createStyles);
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
  const styles = useThemedStyles(createStyles);
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

export interface GhostCardProps {
  /** The button in the middle of the card, e.g. "Crear meta" or "Conectar cuenta". */
  actionLabel: string;
  onAction: () => void;
  /** Why the card is empty, read after the button, e.g. "Aún no tienes metas". */
  message?: string;
  /** On a blue surface (Dashboard header): translucent white shapes and a white button. */
  onPrimary?: boolean;
  /** Size and radius of the card it stands in for, e.g. { width: 206, height: 112 }. */
  style?: ViewStyle;
  testID?: string;
}

/**
 * Empty card: the outline of a card with still gray shapes (a tile and three lines) and a button
 * in the middle, for a section with nothing yet (no goals, no accounts). It never pulses, so it
 * does not read as loading. New component, needs design review (QA review 2026-11-07).
 */
export function GhostCard({
  actionLabel,
  onAction,
  message,
  onPrimary = false,
  style,
  testID,
}: GhostCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const shape = [styles.shape, onPrimary && styles.shapeOnPrimary];
  const ink = onPrimary ? colors.primary : colors.onPrimary;
  return (
    <View style={[styles.ghost, onPrimary && styles.ghostOnPrimary, style]} testID={testID}>
      <View
        style={styles.shapes}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.shapeRow}>
          <View style={[shape, styles.tile]} />
          <View style={[shape, styles.line, { width: '45%' }]} />
        </View>
        <View style={[shape, styles.thin]} />
        <View style={styles.shapeRow}>
          <View style={[shape, styles.line, { width: '35%' }]} />
          <View style={[shape, styles.line, { width: '15%' }]} />
        </View>
      </View>
      <View style={styles.center} pointerEvents="box-none">
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityHint={message}
          hitSlop={8}
          style={({ pressed }) => [
            styles.ghostButton,
            { backgroundColor: onPrimary ? colors.onPrimary : colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="plus" size={16} strokeWidth={2.6} color={ink} />
          <Text style={[styles.ghostLabel, { color: ink }]}>{actionLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    state: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 12 },
    action: { marginTop: 8 },
    skeleton: { backgroundColor: colors.divider },
    ghost: {
      minHeight: 104,
      padding: 16,
      borderRadius: radius.card,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.border,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    ghostOnPrimary: { backgroundColor: 'transparent', borderColor: colors.onPrimaryTrack },
    shapes: { flex: 1, justifyContent: 'space-between', gap: 8 },
    shapeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    shape: { backgroundColor: colors.divider, borderRadius: radius.pill },
    shapeOnPrimary: { backgroundColor: colors.onPrimaryFaint },
    tile: { width: 32, height: 32, borderRadius: radius.tileSm },
    line: { height: 10 },
    thin: { height: 6 },
    center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    ghostButton: {
      height: 36,
      paddingHorizontal: 16,
      borderRadius: radius.pill,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    ghostLabel: { fontFamily: fonts.body.bold, fontSize: 13 },
    pressed: { opacity: 0.85 },
  });
