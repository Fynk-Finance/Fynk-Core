// The fields of a savings goal (SCRUM-51), shared by the GoalForm screen and the goal cards of
// onboarding step 4 (design OnbMetas): Nombre de la meta, Categoría, Monto objetivo, Fecha límite
// ("Jun 2027") and the live "Aporte mensual sugerido · 8 meses para llegar a $5.000.000 ·
// $625.000" box. It holds no state: the parent keeps the form and the errors.
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCop } from '@shared/domain/money';
import type { IsoDate, MoneyMinor } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Dropdown,
  Icon,
  TextField,
  radius,
  size,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { GOAL_CATEGORIES, type GoalError, type GoalField } from '../domain/goal';
import { addMonths, suggestionPreview, type GoalForm } from './goalFormState';
import { GOAL_ICONS } from './goalIcons';
import { monthLabel, savingsStrings } from './strings.es-CO';

const t = savingsStrings.form;
const CATEGORY_OPTIONS = GOAL_CATEGORIES.map((value) => ({
  value,
  label: savingsStrings.categories[value],
  icon: GOAL_ICONS[value],
}));

export interface GoalFormFieldsProps {
  form: GoalForm;
  onChange: (patch: Partial<GoalForm>) => void;
  errors: Partial<Record<GoalField, GoalError>>;
  /** Today's date in Bogotá, for the suggested amount. */
  today: IsoDate;
  /** Saved so far: the suggestion counts only what is left. */
  savedMinor?: MoneyMinor;
  /** The month picker never goes before this month ("2026-10"). */
  firstMonth: string;
  loading?: boolean;
  /** Prefix of the test ids: `savings.form` by default. */
  testID?: string;
}

export function GoalFormFields({
  form,
  onChange: set,
  errors,
  today,
  savedMinor = 0,
  firstMonth,
  loading = false,
  testID = 'savings.form',
}: GoalFormFieldsProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const errorOf = (field: GoalField) => (errors[field] ? t.errors[errors[field]] : undefined);
  const preview = suggestionPreview(form, today, savedMinor);
  const step = (delta: number) => set({ deadline: addMonths(form.deadline, delta) });
  const canGoBack = form.deadline > firstMonth;

  return (
    <>
      <TextField
        label={t.name}
        icon="goal"
        value={form.name}
        onChangeText={(name) => set({ name })}
        placeholder={t.namePlaceholder}
        error={errorOf('name')}
        maxLength={60}
        editable={!loading}
        testID={`${testID}.name`}
      />

      {/* QA review 2026-11-07, V11: a dropdown with icons instead of chips. */}
      <Dropdown
        label={t.category}
        options={CATEGORY_OPTIONS}
        value={form.category}
        onChange={(category) => set({ category })}
        testID={`${testID}.category`}
      />

      <TextField
        label={t.target}
        icon="piggy"
        value={form.target}
        onChangeText={(target) => set({ target })}
        placeholder={t.targetPlaceholder}
        keyboardType="numeric"
        error={errorOf('target')}
        testID={`${testID}.target`}
      />

      <View style={styles.field}>
        <AppText variant="label">{t.deadline}</AppText>
        <View style={[styles.month, errors.deadline ? styles.monthError : null]}>
          <Pressable
            onPress={() => step(-1)}
            disabled={!canGoBack}
            accessibilityRole="button"
            accessibilityLabel={t.previousMonth}
            accessibilityState={{ disabled: !canGoBack }}
            hitSlop={8}
            style={!canGoBack ? styles.disabled : null}
            testID={`${testID}.deadline.previous`}
          >
            <Icon name="chevronLeft" size={22} color={colors.primaryDark} />
          </Pressable>
          <View style={styles.monthLabel}>
            <Icon name="calendar" size={18} color={colors.primaryDark} />
            <AppText
              variant="bodyStrong"
              accessibilityLabel={`${t.deadline}: ${monthLabel(form.deadline)}`}
              testID={`${testID}.deadline`}
            >
              {monthLabel(form.deadline)}
            </AppText>
          </View>
          <Pressable
            onPress={() => step(1)}
            accessibilityRole="button"
            accessibilityLabel={t.nextMonth}
            hitSlop={8}
            testID={`${testID}.deadline.next`}
          >
            <Icon name="chevronRight" size={22} color={colors.primaryDark} />
          </Pressable>
        </View>
        {errorOf('deadline') ? (
          <AppText variant="caption" color="danger">
            {errorOf('deadline')}
          </AppText>
        ) : null}
      </View>

      <View style={styles.suggested} testID={`${testID}.suggested`}>
        <View style={styles.suggestedText}>
          <AppText variant="captionStrong">{t.suggested}</AppText>
          <AppText variant="caption" color="textSecondary" style={styles.small}>
            {preview
              ? t.suggestedDetail(preview.months, formatCop(preview.targetMinor))
              : t.suggestedEmpty}
          </AppText>
        </View>
        {preview ? (
          <AmountText amountMinor={preview.suggestedMinor} size={15} color="accentText" />
        ) : null}
      </View>
    </>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    field: { gap: spacing.md },
    // Same box as the text fields (TextField), with the month between two chevrons.
    month: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: size.input,
      paddingHorizontal: 16,
      borderRadius: radius.input,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.surfaceBlueSoft,
    },
    monthError: { borderColor: colors.danger },
    monthLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    disabled: { opacity: 0.3 },
    // OnbMetas: lime tinted box with the suggested amount in dark green.
    suggested: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.tile,
      borderWidth: 1,
      borderColor: colors.accentSoft,
      backgroundColor: colors.accentSurface,
    },
    suggestedText: { flexShrink: 1, gap: 1 },
    small: { fontSize: 11, lineHeight: 14 },
  });
