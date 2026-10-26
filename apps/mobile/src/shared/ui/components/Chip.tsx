// Filter chip of VerdeRecomendaciones ("Todas", "Gastos", "Ahorro", "Suscripciones").
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, size } from '../tokens';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
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
      <Text style={[styles.label, { color: selected ? colors.white : colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: size.chip,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.primaryDark, borderColor: colors.primaryDark },
  idle: { backgroundColor: colors.white, borderColor: colors.surfaceBlue },
  pressed: { backgroundColor: colors.surfaceBlueSoft },
  label: { fontFamily: fonts.body.semibold, fontSize: 13 },
});
