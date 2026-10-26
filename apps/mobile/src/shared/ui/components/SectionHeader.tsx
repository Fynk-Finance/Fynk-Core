// Section title with a green link ("Planes de ahorro · Ver todos") or a grey note
// ("Suscripciones · 4 activas · $112.600/mes").
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './AppText';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Grey note on the right when there is no action. */
  meta?: ReactNode;
}

export function SectionHeader({ title, actionLabel, onAction, meta }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <AppText variant="section" accessibilityRole="header" style={styles.title}>
        {title}
      </AppText>
      {actionLabel ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="link"
          hitSlop={8}
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          <AppText variant="smallStrong" color="link">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : typeof meta === 'string' ? (
        <AppText variant="captionStrong" color="textSecondary">
          {meta}
        </AppText>
      ) : (
        meta
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  title: { flexShrink: 1 },
  pressed: { opacity: 0.6 },
});
