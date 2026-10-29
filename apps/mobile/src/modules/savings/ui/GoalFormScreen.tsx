// Create or edit a savings goal (SCRUM-51), with the fields of the goal card in the design's
// OnbMetas: Nombre de la meta, Categoría, Monto objetivo, Fecha límite ("Jun 2027") and the live
// "Aporte mensual sugerido · 8 meses para llegar a $5.000.000 · $625.000" box. As a full screen
// it is new and needs design review. Pushed with the default transition.
// Route params: { id } to edit, none to create.
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCop } from '@shared/domain/money';
import type { MoneyMinor } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  BackButton,
  Chip,
  GhostButton,
  Icon,
  PrimaryButton,
  Screen,
  TextField,
  radius,
  size,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { GoalService } from '../application/goalService';
import { GOAL_CATEGORIES, type GoalError, type GoalField } from '../domain/goal';
import {
  addMonths,
  emptyGoalForm,
  formFromGoal,
  readGoalForm,
  suggestionPreview,
  type GoalForm,
} from './goalFormState';
import { monthLabel, savingsStrings } from './strings.es-CO';

const t = savingsStrings.form;

export const GOAL_FORM_ROUTE = 'savings.GoalForm' as const;
export type GoalFormParams = { id?: string } | undefined;

export function createGoalFormScreen({ service }: { service: GoalService }) {
  return function GoalFormScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const id = (route.params as GoalFormParams)?.id;
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const today = service.today();

    const [form, setForm] = useState<GoalForm>(() => emptyGoalForm(today));
    const [kept, setKept] = useState<{ deadline: string; saved: MoneyMinor } | null>(null);
    const [errors, setErrors] = useState<Partial<Record<GoalField, GoalError>>>({});
    const [loading, setLoading] = useState(Boolean(id));
    const [saving, setSaving] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    useEffect(() => {
      if (!id) return;
      let active = true;
      service
        .get(id)
        .then((goal) => {
          if (!active) return;
          if (!goal) return setFailure(t.notFound);
          setForm(formFromGoal(goal));
          setKept({ deadline: goal.deadline, saved: goal.savedMinor });
        })
        .catch(() => active && setFailure(t.saveFailed))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [id]);

    const set = (patch: Partial<GoalForm>) => setForm((f) => ({ ...f, ...patch }));
    const errorOf = (field: GoalField) => (errors[field] ? t.errors[errors[field]] : undefined);
    const preview = suggestionPreview(form, today, kept?.saved ?? 0);
    // The stepper never goes before the current month, unless an old goal already is.
    const firstMonth = [today.slice(0, 7), kept?.deadline ?? '9999-12'].sort()[0]!;

    const save = async () => {
      const read = readGoalForm(form, today, kept?.deadline);
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

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <BackButton tone="plain" accessibilityLabel={t.back} onPress={() => navigation.goBack()} />
        <AppText variant="screenTitle" accessibilityRole="header">
          {id ? t.editTitle : t.newTitle}
        </AppText>
      </View>
    );

    const step = (delta: number) => set({ deadline: addMonths(form.deadline, delta) });
    const canGoBack = form.deadline > firstMonth;

    return (
      <Screen header={header} scroll padded={false} testID="savings.form">
        <View style={styles.content}>
          <TextField
            label={t.name}
            icon="goal"
            value={form.name}
            onChangeText={(name) => set({ name })}
            placeholder={t.namePlaceholder}
            error={errorOf('name')}
            maxLength={60}
            editable={!loading}
            testID="savings.form.name"
          />

          <View style={styles.field}>
            <AppText variant="label">{t.category}</AppText>
            <View style={styles.chips} accessibilityRole="radiogroup">
              {GOAL_CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={savingsStrings.categories[c]}
                  selected={form.category === c}
                  onPress={() => set({ category: c })}
                  testID={`savings.form.category.${c}`}
                />
              ))}
            </View>
          </View>

          <TextField
            label={t.target}
            icon="piggy"
            value={form.target}
            onChangeText={(target) => set({ target })}
            placeholder={t.targetPlaceholder}
            keyboardType="numeric"
            error={errorOf('target')}
            testID="savings.form.target"
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
                testID="savings.form.deadline.previous"
              >
                <Icon name="chevronLeft" size={22} color={colors.primaryDark} />
              </Pressable>
              <View style={styles.monthLabel}>
                <Icon name="calendar" size={18} color={colors.primaryDark} />
                <AppText
                  variant="bodyStrong"
                  accessibilityLabel={`${t.deadline}: ${monthLabel(form.deadline)}`}
                  testID="savings.form.deadline"
                >
                  {monthLabel(form.deadline)}
                </AppText>
              </View>
              <Pressable
                onPress={() => step(1)}
                accessibilityRole="button"
                accessibilityLabel={t.nextMonth}
                hitSlop={8}
                testID="savings.form.deadline.next"
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

          <View style={styles.suggested} testID="savings.form.suggested">
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
            testID="savings.form.save"
          />
          {id ? (
            <GhostButton
              label={t.delete}
              tone="danger"
              icon="trash"
              onPress={confirmDelete}
              testID="savings.form.delete"
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
