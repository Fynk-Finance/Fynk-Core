// Create or edit a savings goal (SCRUM-51), with the fields of the goal card in the design's
// OnbMetas: Nombre de la meta, Categoría, Monto objetivo, Fecha límite ("Jun 2027") and the live
// "Aporte mensual sugerido · 8 meses para llegar a $5.000.000 · $625.000" box. As a full screen
// it is new and needs design review. Pushed with the default transition.
// Route params: { id } to edit, none to create.
import { useNavigation, useRoute } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MoneyMinor } from '@shared/domain/types';
import {
  AppText,
  BackButton,
  GhostButton,
  PrimaryButton,
  Screen,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { GoalService } from '../application/goalService';
import type { GoalError, GoalField } from '../domain/goal';
import { emptyGoalForm, formFromGoal, readGoalForm, type GoalForm } from './goalFormState';
import { GoalFormFields } from './GoalFormFields';
import { savingsStrings } from './strings.es-CO';

const t = savingsStrings.form;

export const GOAL_FORM_ROUTE = 'savings.GoalForm' as const;
export type GoalFormParams = { id?: string } | undefined;

export function createGoalFormScreen({ service }: { service: GoalService }) {
  return function GoalFormScreen() {
    const navigation = useNavigation();
    const route = useRoute();
    const id = (route.params as GoalFormParams)?.id;
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

    return (
      <Screen header={header} scroll padded={false} testID="savings.form">
        <View style={styles.content}>
          <GoalFormFields
            form={form}
            onChange={set}
            errors={errors}
            today={today}
            savedMinor={kept?.saved ?? 0}
            firstMonth={firstMonth}
            loading={loading}
          />

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
  });
