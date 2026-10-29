// 44 px back button: translucent white on blue headers (VerdeOnbNombre, VerdeDetalleCuentas),
// plain blue chevron on white screens (VerdeNotificaciones).
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '../icons';
import { uiStrings } from '../strings.es-CO';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { radius, size } from '../tokens';

export interface BackButtonProps {
  onPress?: () => void;
  tone?: 'onPrimary' | 'plain';
  accessibilityLabel?: string;
}

export function BackButton({ onPress, tone = 'onPrimary', accessibilityLabel }: BackButtonProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const onPrimary = tone === 'onPrimary';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? uiStrings.back}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        onPrimary ? styles.onPrimary : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <Icon
        name="chevronLeft"
        size={onPrimary ? 20 : 30}
        strokeWidth={2.4}
        color={onPrimary ? colors.onPrimary : colors.primaryDark}
      />
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    button: {
      width: size.backButton,
      height: size.backButton,
      borderRadius: radius.input,
      alignItems: 'center',
      justifyContent: 'center',
    },
    onPrimary: { backgroundColor: colors.onPrimaryOverlay },
    pressed: { opacity: 0.7 },
  });
