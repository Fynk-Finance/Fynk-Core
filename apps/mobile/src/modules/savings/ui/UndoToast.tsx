// Toast after an aporte: "Abonaste $100.000 a Viaje a Cartagena · Deshacer". The design only
// animates `.fb-toast` (fade and rise, centered at the bottom) and does not draw it, so it is
// new and needs design review. It stays 5 s so there is time to undo, and announces itself to
// screen readers.
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fonts, radius, spacing, useThemedStyles, type Theme } from '@shared/ui';

import { savingsStrings } from './strings.es-CO';

export const TOAST_MS = 5000;

export interface UndoToastProps {
  message: string;
  /** Without it the toast only informs ("Abono deshecho"). */
  onUndo?: () => void;
  onHide: () => void;
}

export function UndoToast({ message, onUndo, onHide }: UndoToastProps) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const timer = setTimeout(onHide, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, onHide]);

  return (
    <View
      style={[styles.toast, { bottom: insets.bottom + 100 }]}
      accessibilityLiveRegion="polite"
      testID="savings.toast"
    >
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      {onUndo ? (
        <Pressable
          onPress={onUndo}
          accessibilityRole="button"
          hitSlop={8}
          testID="savings.toast.undo"
        >
          <Text style={styles.undo}>{savingsStrings.abonar.undo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    toast: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: radius.input,
      backgroundColor: colors.textPrimary,
      ...shadow.card,
    },
    message: {
      flex: 1,
      fontFamily: fonts.body.semibold,
      fontSize: 13,
      lineHeight: 18,
      color: colors.background,
    },
    undo: { fontFamily: fonts.body.bold, fontSize: 13, color: colors.accent },
  });
