// Dropdown of the category fields (QA review 2026-11-07, V11), in place of a long row of chips.
// The design has none, so it is built from the text field of Login and OnbNombre: label above,
// a 56 px light blue field with the icon tile of the choice and a chevron. A tap unfolds the
// list right below it, inside the form (no second sheet over the movement sheet); each row has
// its icon and a check on the choice, and picking one folds it back. New component, needs
// design review.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type IconName } from '../icons';
import { useTheme, useThemedStyles, type Theme } from '../theme';
import { fonts, motion, radius, size, spacing } from '../tokens';
import { AppText } from './AppText';
import { IconTile } from './IconTile';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
  icon: IconName;
}

export interface DropdownProps<T extends string> {
  /** Above the field, and what the field reads as: "Categoría: Mercado". */
  label: string;
  options: readonly DropdownOption<T>[];
  value: T | null;
  onChange: (next: T) => void;
  /** Shown while nothing is chosen and there is no `noneLabel`. */
  placeholder?: string;
  /** A first row that clears the choice ("Sin categoría"), with `onClear`. */
  noneLabel?: string;
  onClear?: () => void;
  disabled?: boolean;
  /** The field; each row is `<testID>.<value>`, the clearing row `<testID>.none`. */
  testID?: string;
}

/** About five rows show at once; the rest scroll inside the list. */
const ROW_HEIGHT = 48;
const VISIBLE_ROWS = 5;

export function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
  placeholder,
  noneLabel,
  onClear,
  disabled = false,
  testID,
}: DropdownProps<T>) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const chosen = options.find((o) => o.value === value) ?? null;
  const shown = chosen?.label ?? noneLabel ?? placeholder ?? '';
  const chevron = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withTiming(open ? '180deg' : '0deg', { duration: reduceMotion ? 0 : motion.base }),
      },
    ],
  }));

  const pick = (run: () => void) => {
    setOpen(false);
    run();
  };

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityState={{ expanded: open, disabled }}
        testID={testID}
        style={[styles.field, open ? styles.fieldOpen : null, disabled ? styles.disabled : null]}
      >
        {chosen ? <IconTile icon={chosen.icon} tone="soft" size={32} /> : null}
        <Text
          numberOfLines={1}
          style={[
            styles.value,
            { color: chosen || noneLabel ? colors.textPrimary : colors.textPlaceholder },
          ]}
        >
          {shown}
        </Text>
        <Animated.View style={chevron}>
          <Icon name="chevronDown" size={20} strokeWidth={2.2} color={colors.primaryDark} />
        </Animated.View>
      </Pressable>
      {open ? (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(motion.base)}
          exiting={reduceMotion ? undefined : FadeOut.duration(motion.fast)}
          style={styles.list}
        >
          <ScrollView
            nestedScrollEnabled
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: ROW_HEIGHT * VISIBLE_ROWS }}
            accessibilityRole="radiogroup"
            accessibilityLabel={label}
          >
            {noneLabel ? (
              <Row
                label={noneLabel}
                selected={value === null}
                onPress={() => pick(() => onClear?.())}
                testID={testID ? `${testID}.none` : undefined}
              />
            ) : null}
            {options.map((option) => (
              <Row
                key={option.value}
                label={option.label}
                icon={option.icon}
                selected={option.value === value}
                onPress={() => pick(() => onChange(option.value))}
                testID={testID ? `${testID}.${option.value}` : undefined}
              />
            ))}
          </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
}

function Row({
  label,
  icon,
  selected,
  onPress,
  testID,
}: {
  label: string;
  icon?: IconName;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      testID={testID}
      style={({ pressed }) => [styles.row, selected || pressed ? styles.rowActive : null]}
    >
      {icon ? <IconTile icon={icon} tone="soft" size={26} /> : <View style={styles.noIcon} />}
      <Text numberOfLines={1} style={[styles.rowLabel, selected ? styles.rowLabelSelected : null]}>
        {label}
      </Text>
      {selected ? (
        <Icon name="check" size={18} strokeWidth={2.4} color={colors.primaryDark} />
      ) : null}
    </Pressable>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    wrapper: { gap: spacing.md },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      height: size.input,
      paddingLeft: spacing.xl,
      paddingRight: 16,
      borderRadius: radius.input,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.surfaceBlueSoft,
    },
    // Like the focused text field.
    fieldOpen: { borderColor: colors.primary, backgroundColor: colors.background },
    disabled: { opacity: 0.5 },
    value: { flex: 1, fontFamily: fonts.body.semibold, fontSize: 15 },
    list: {
      borderRadius: radius.input,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
      height: ROW_HEIGHT,
      paddingHorizontal: spacing.xl,
    },
    rowActive: { backgroundColor: colors.surfaceBlueSoft },
    noIcon: { width: 26 },
    rowLabel: { flex: 1, fontFamily: fonts.body.medium, fontSize: 14, color: colors.textPrimary },
    rowLabelSelected: { fontFamily: fonts.body.bold, color: colors.primaryDark },
  });
