// Period control on blue headers (Estadísticas "3 días, Semana, Mes, Año", `.seg`): equal options
// in a translucent track (padding 4, gap 4, radius 16), each 40 px high with radius 12 and 13 px
// bold text. The selected option is the page color with blue text; the others are white text.
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme, useThemedStyles, type Theme } from '../theme';
import { fonts, radius, size } from '../tokens';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Required: what the options choose, e.g. "Periodo de la gráfica". */
  accessibilityLabel: string;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={styles.track}
      testID={testID}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, checked: selected }}
            testID={testID ? `${testID}-${option.value}` : undefined}
            style={({ pressed }) => [
              styles.option,
              selected ? styles.selected : pressed ? styles.pressed : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, { color: selected ? colors.primaryText : colors.onPrimary }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: radius.button,
      backgroundColor: colors.onPrimaryFaint,
    },
    option: {
      flex: 1,
      height: size.segment,
      borderRadius: radius.tile,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selected: { backgroundColor: colors.background },
    pressed: { backgroundColor: colors.onPrimaryPressed },
    label: { fontFamily: fonts.body.bold, fontSize: 13 },
  });
