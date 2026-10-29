// Filter chip of Recomendaciones ("Todas", "Gastos", "Ahorro", "Suscripciones").
import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme, useThemedStyles, type Theme } from '../theme';
import { fonts, radius, size } from '../tokens';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      testID={testID}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.idle,
        pressed && !selected ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.label, { color: selected ? colors.onPrimary : colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    chip: {
      height: size.chip,
      paddingHorizontal: 16,
      borderRadius: radius.pill,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
    idle: { backgroundColor: colors.background, borderColor: colors.borderBlue },
    pressed: { backgroundColor: colors.surfaceBlueSoft },
    label: { fontFamily: fonts.body.semibold, fontSize: 13 },
  });
