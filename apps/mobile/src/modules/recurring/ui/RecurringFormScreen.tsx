// Add or edit a fixed expense or subscription (SCRUM-54). New screen, needs design review: it is
// built from the fields of the onboarding card in the design (OnbGastos: Nombre, Categoría,
// Monto, Día de pago, Recordatorio, Eliminar gasto) plus the type and periodicity of HU-038.
// Pushed with the default transition. Route params: { id } to edit, none to add.
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryLabel } from '@shared/domain/categories';
import {
  AppText,
  BackButton,
  Chip,
  GhostButton,
  PrimaryButton,
  Screen,
  SegmentedControl,
  Switch,
  TextField,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { RecurringError, RecurringField } from '../domain/item';
import type { RecurringService } from '../application/recurringService';
import {
  FORM_CATEGORIES,
  emptyForm,
  formFromItem,
  readForm,
  withPeriodicity,
  type FormPeriodicity,
  type RecurringForm,
} from './formState';
import { recurringStrings } from './strings.es-CO';

const t = recurringStrings.form;
/** Monday first, as people read a week in Colombia. */
const WEEK = [1, 2, 3, 4, 5, 6, 0];

export const RECURRING_FORM_ROUTE = 'recurring.Form' as const;
/** The same form opened by a reminder's link, fynk://billetera/recurrentes/<id>. */
export const RECURRING_EDIT_ROUTE = 'recurring.Edit' as const;
export type RecurringFormParams = { id?: string } | undefined;

export function createRecurringFormScreen({ service }: { service: RecurringService }) {
  return function RecurringFormScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const id = (route.params as RecurringFormParams)?.id;
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();

    const [form, setForm] = useState<RecurringForm>(emptyForm);
    const [errors, setErrors] = useState<Partial<Record<RecurringField, RecurringError>>>({});
    const [loading, setLoading] = useState(Boolean(id));
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    useEffect(() => {
      if (!id) return;
      let active = true;
      service
        .get(id)
        .then((item) => {
          if (!active) return;
          if (item) setForm(formFromItem(item));
          else setFailure(t.notFound);
        })
        .catch(() => active && setFailure(t.saveFailed))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [id]);

    const set = (patch: Partial<RecurringForm>) => setForm((f) => ({ ...f, ...patch }));
    const errorOf = (field: RecurringField) =>
      errors[field] ? t.errors[errors[field]] : undefined;

    const save = async () => {
      const read = readForm(form);
      if (!read.ok) {
        setErrors(read.errors);
        return;
      }
      setErrors({});
      setSaving(true);
      setFailure(null);
      try {
        if (id) await service.update(id, read.input);
        else await service.create(read.input);
        navigation.goBack();
      } catch {
        setFailure(t.saveFailed);
      } finally {
        setSaving(false);
      }
    };

    const confirmDelete = () => {
      if (!id) return;
      Alert.alert(t.confirmDelete.title(form.name.trim()), t.confirmDelete.message, [
        { text: t.confirmDelete.cancel, style: 'cancel' },
        {
          text: t.confirmDelete.confirm,
          style: 'destructive',
          onPress: () => {
            service
              .remove(id)
              .then(() => navigation.goBack())
              .catch(() => setFailure(t.saveFailed));
          },
        },
      ]);
    };

    const toggleDay = (day: number) => {
      const bit = 1 << day;
      if (form.periodicity === 'weekly') set({ weekdaysMask: bit });
      else set({ weekdaysMask: form.weekdaysMask ^ bit });
    };

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <BackButton tone="plain" accessibilityLabel={t.back} onPress={() => navigation.goBack()} />
        <AppText variant="screenTitle" accessibilityRole="header">
          {id ? t.editTitle : t.newTitle}
        </AppText>
      </View>
    );

    return (
      <Screen header={header} scroll padded={false} testID="recurring.form">
        <View style={styles.content}>
          <TextField
            label={t.name}
            value={form.name}
            onChangeText={(name) => set({ name })}
            placeholder={t.namePlaceholder}
            error={errorOf('name')}
            maxLength={60}
            editable={!loading}
            testID="recurring.form.name"
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
              testID="recurring.form.kind"
            />
          </View>

          <View style={styles.field}>
            <AppText variant="label">{t.category}</AppText>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {FORM_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={categoryLabel(c)}
                  selected={form.categoryId === c}
                  onPress={() => set({ categoryId: c })}
                  testID={`recurring.form.category.${c}`}
                />
              ))}
            </View>
          </View>

          <TextField
            label={t.amount}
            value={form.amount}
            onChangeText={(amount) => set({ amount })}
            placeholder={t.amountPlaceholder}
            keyboardType="numeric"
            error={errorOf('amount')}
            testID="recurring.form.amount"
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
              testID="recurring.form.periodicity"
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
              testID="recurring.form.day"
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
                    testID={`recurring.form.weekday.${d}`}
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
              testID="recurring.form.reminder"
            />
          </View>

          {failure ? (
            <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
              {failure}
            </AppText>
          ) : null}

          <PrimaryButton
            label={t.save}
            onPress={() => void save()}
            loading={saving}
            disabled={loading}
            testID="recurring.form.save"
          />
          {id ? (
            <GhostButton
              label={t.delete}
              tone="danger"
              icon="trash"
              onPress={confirmDelete}
              testID="recurring.form.delete"
            />
          ) : null}
        </View>
      </Screen>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    header: { paddingHorizontal: 16, gap: spacing.md, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, paddingBottom: 32, gap: spacing.section },
    field: { gap: spacing.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    reminder: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    reminderText: { flexGrow: 1, flexShrink: 1, gap: 2 },
  });
