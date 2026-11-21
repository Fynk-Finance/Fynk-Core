// Equal options in a track (padding 4, gap 4, radius 16), each 40 px high with radius 12 and
// 13 px bold text.
// * `onPrimary`: the period control of blue headers (Estadísticas "3 días, Semana, Mes, Año",
//   `.seg`): a translucent track, the selected option in the page color with blue text, the
//   others in white text.
// * Default, on the page or a sheet (recurring form "Tipo", filters, cap form): the design has
//   no such control, so it turns the header one around: a soft blue track with a blue border,
//   the selected option in the page color with a stronger blue border and blue text, the others
//   in the text color. Every text meets AA contrast in both themes. New component state, needs
//   design review (QA review 2026-11-07, V12).
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
  /** On a blue surface (Estadísticas header): translucent track and white text. */
  onPrimary?: boolean;
  testID?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  onPrimary = false,
  testID,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const tone = onPrimary ? styles.onPrimary : styles.page;
  const selectedText = colors.primaryText;
  const idleText = onPrimary ? colors.onPrimary : colors.textPrimary;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, tone.track]}
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
              selected ? tone.selected : pressed ? tone.pressed : null,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.label, { color: selected ? selectedText : idleText }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = ({ colors }: Theme) => {
  const base = StyleSheet.create({
    track: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.button },
    option: {
      flex: 1,
      height: size.segment,
      borderRadius: radius.tile,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: { fontFamily: fonts.body.bold, fontSize: 13 },
  });
  return {
    ...base,
    onPrimary: StyleSheet.create({
      track: { backgroundColor: colors.onPrimaryFaint },
      selected: { backgroundColor: colors.background },
      pressed: { backgroundColor: colors.onPrimaryPressed },
    }),
    page: StyleSheet.create({
      track: {
        backgroundColor: colors.surfaceBlueSoft,
        borderWidth: 1,
        borderColor: colors.borderBlue,
      },
      selected: {
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.borderBlueStrong,
      },
      pressed: { backgroundColor: colors.borderBlue },
    }),
  };
};
