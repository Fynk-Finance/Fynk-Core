// The fields of a fixed expense or subscription (SCRUM-54), shared by the RecurringForm screen
// and the cards of onboarding step 5 (design OnbGastos): Nombre, Tipo, Categoría, Monto, the
// periodicity with its day or weekdays, "¿Cuánto la usas?" for a subscription and Recordatorio.
// It holds no state: the parent keeps the form and the errors.
import { StyleSheet, View } from 'react-native';

import {
  AppText,
  Chip,
  Dropdown,
  MoneyField,
  SegmentedControl,
  Switch,
  TextField,
  categoryOptions,
  spacing,
  useThemedStyles,
} from '@shared/ui';

import type { RecurringError, RecurringField } from '../domain/item';
import type { Usage } from '../domain/types';
import {
  FORM_CATEGORIES,
  withPeriodicity,
  type FormPeriodicity,
  type RecurringForm,
} from './formState';
import { recurringStrings } from './strings.es-CO';

const t = recurringStrings.form;
const CATEGORY_OPTIONS = categoryOptions(FORM_CATEGORIES);
/** Monday first, as people read a week in Colombia. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const USAGES: readonly Usage[] = ['high', 'some', 'low'];

export interface RecurringFormFieldsProps {
  form: RecurringForm;
  /** Receives the next form. */
  onChange: (next: RecurringForm) => void;
  errors: Partial<Record<RecurringField, RecurringError>>;
  loading?: boolean;
  /** Prefix of the test ids: `recurring.form` by default. */
  testID?: string;
}

export function RecurringFormFields({
  form,
  onChange,
  errors,
  loading = false,
  testID = 'recurring.form',
}: RecurringFormFieldsProps) {
  const styles = useThemedStyles(createStyles);
  const set = (patch: Partial<RecurringForm>) => onChange({ ...form, ...patch });
  const setForm = (f: (current: RecurringForm) => RecurringForm) => onChange(f(form));
  const errorOf = (field: RecurringField) => (errors[field] ? t.errors[errors[field]] : undefined);
  const toggleDay = (day: number) => {
    const bit = 1 << day;
    if (form.periodicity === 'weekly') set({ weekdaysMask: bit });
    else set({ weekdaysMask: form.weekdaysMask ^ bit });
  };

  return (
    <>
      <TextField
        label={t.name}
        value={form.name}
        onChangeText={(name) => set({ name })}
        placeholder={t.namePlaceholder}
        error={errorOf('name')}
        maxLength={60}
        editable={!loading}
        testID={`${testID}.name`}
      />

      <View style={styles.field}>
        <AppText variant="label">{t.kind}</AppText>
        <SegmentedControl
          options={[
            { value: 'fixed', label: t.kinds.fixed },
            { value: 'subscription', label: t.kinds.subscription },
          ]}
          value={form.kind}
          onChange={(kind) => set({ kind })}
          accessibilityLabel={t.kind}
          testID={`${testID}.kind`}
        />
      </View>

      {/* QA review 2026-11-07, V11: a dropdown with icons instead of chips. */}
      <Dropdown
        label={t.category}
        options={CATEGORY_OPTIONS}
        value={form.categoryId}
        onChange={(categoryId) => set({ categoryId })}
        testID={`${testID}.category`}
      />

      <MoneyField
        label={t.amount}
        value={form.amount}
        onChangeText={(amount) => set({ amount })}
        placeholder={t.amountPlaceholder}
        error={errorOf('amount')}
        testID={`${testID}.amount`}
      />

      <View style={styles.field}>
        <AppText variant="label">{t.periodicity}</AppText>
        <SegmentedControl<FormPeriodicity>
          options={[
            { value: 'monthly', label: t.periodicities.monthly },
            { value: 'weekly', label: t.periodicities.weekly },
            { value: 'daily', label: t.periodicities.daily },
          ]}
          value={form.periodicity}
          onChange={(p) => setForm((f) => withPeriodicity(f, p))}
          accessibilityLabel={t.periodicity}
          testID={`${testID}.periodicity`}
        />
      </View>

      {form.periodicity === 'monthly' ? (
        <TextField
          label={t.day}
          value={form.day}
          onChangeText={(day) => set({ day })}
          keyboardType="number-pad"
          maxLength={2}
          helper={t.dayHelper}
          error={errorOf('schedule')}
          testID={`${testID}.day`}
        />
      ) : (
        <View style={styles.field}>
          <AppText variant="label">
            {form.periodicity === 'weekly' ? t.weekday : t.weekdays}
          </AppText>
          <View style={styles.chips}>
            {WEEK.map((d) => (
              <Chip
                key={d}
                label={recurringStrings.weekdayShort[d] ?? ''}
                selected={(form.weekdaysMask & (1 << d)) !== 0}
                onPress={() => toggleDay(d)}
                testID={`${testID}.weekday.${d}`}
              />
            ))}
          </View>
          {errorOf('schedule') ? (
            <AppText variant="caption" color="danger">
              {errorOf('schedule')}
            </AppText>
          ) : null}
        </View>
      )}

      {form.kind === 'subscription' ? (
        <View style={styles.field}>
          <AppText variant="label">{t.usage}</AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {USAGES.map((u) => (
              <Chip
                key={u}
                label={t.usages[u]}
                selected={form.usage === u}
                onPress={() => set({ usage: form.usage === u ? null : u })}
                testID={`${testID}.usage.${u}`}
              />
            ))}
          </View>
          <AppText variant="caption" color="textSecondary">
            {t.usageHelper}
          </AppText>
        </View>
      ) : null}

      <View style={styles.reminder}>
        <View style={styles.reminderText}>
          <AppText variant="label">{t.reminder}</AppText>
          <AppText variant="caption" color="textSecondary">
            {form.reminderEnabled ? t.reminderOn : t.reminderOff}
          </AppText>
        </View>
        <Switch
          value={form.reminderEnabled}
          onValueChange={(reminderEnabled) => set({ reminderEnabled })}
          accessibilityLabel={t.reminder}
          testID={`${testID}.reminder`}
        />
      </View>
    </>
  );
}

const createStyles = () =>
  StyleSheet.create({
    field: { gap: spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    reminder: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    reminderText: { flexGrow: 1, flexShrink: 1, gap: 2 },
  });
