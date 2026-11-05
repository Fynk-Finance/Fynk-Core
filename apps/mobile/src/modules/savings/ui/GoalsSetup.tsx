// "Crea tus metas" of onboarding step 4 (design OnbMetas), built by M8 for M3 to place inside its
// step frame: the goals as collapsible cards (lime goal tile, name, "Viaje · $5.000.000",
// chevron), the open one with the goal fields and the live suggested amount, and the dashed
// "Agregar otra meta". With no goals yet, a new one is open. Goals are saved in the vault like
// the ones made from Metas; "Continuar" belongs to M3's frame.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCop } from '@shared/domain/money';
import {
  AppText,
  GhostButton,
  Icon,
  IconTile,
  PrimaryButton,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { GoalService } from '../application/goalService';
import type { GoalError, GoalField, GoalSummary } from '../domain/goal';
import { GoalFormFields } from './GoalFormFields';
import { emptyGoalForm, formFromGoal, readGoalForm, type GoalForm } from './goalFormState';
import { savingsStrings, setupStrings as t } from './strings.es-CO';

const NEW = 'new';

export function createGoalsSetup({ service }: { service: GoalService }) {
  return function GoalsSetup() {
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const today = service.today();
    const [goals, setGoals] = useState<GoalSummary[] | null>(null);
    const [open, setOpen] = useState<string | null>(null);
    const [form, setForm] = useState<GoalForm>(() => emptyGoalForm(today));
    const [errors, setErrors] = useState<Partial<Record<GoalField, GoalError>>>({});
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);

    const load = useCallback(async () => {
      const list = await service.list().catch(() => [] as GoalSummary[]);
      setGoals(list);
      return list;
    }, []);

    useEffect(() => {
      void load().then((list) => {
        if (list.length === 0) setOpen(NEW);
      });
    }, [load]);

    const openCard = (id: string | null) => {
      setErrors({});
      setFailure(null);
      setOpen(id);
      const goal = goals?.find((g) => g.id === id);
      setForm(goal ? formFromGoal(goal) : emptyGoalForm(today));
    };

    const editing = goals?.find((g) => g.id === open) ?? null;

    const save = async () => {
      const read = readGoalForm(form, today, editing?.deadline);
      if (!read.ok) return setErrors(read.errors);
      setErrors({});
      setBusy(true);
      setFailure(null);
      try {
        if (editing) await service.update(editing.id, read.input);
        else await service.create(read.input);
        await load();
        setOpen(null);
      } catch {
        setFailure(t.failed);
      } finally {
        setBusy(false);
      }
    };

    const remove = async (id: string) => {
      setBusy(true);
      try {
        await service.remove(id);
        const list = await load();
        setOpen(list.length === 0 ? NEW : null);
        if (list.length === 0) setForm(emptyGoalForm(today));
      } catch {
        setFailure(t.failed);
      } finally {
        setBusy(false);
      }
    };

    const card = (id: string, name: string, summary: string, isOpen: boolean) => (
      <View
        key={id}
        style={[styles.card, isOpen ? styles.cardOpen : null]}
        testID={`savings.setup.${id}`}
      >
        <Pressable
          onPress={() => openCard(isOpen ? null : id)}
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={isOpen ? t.collapse(name) : t.expand(name)}
          style={styles.cardHead}
          testID={`savings.setup.${id}.toggle`}
        >
          <IconTile icon="goal" tone="accent" size={40} />
          <View style={styles.cardText}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption" color="textSecondary" numberOfLines={1}>
              {summary}
            </AppText>
          </View>
          <View style={isOpen ? styles.flipped : null}>
            <Icon name="chevronDown" size={24} color={colors.textSecondary} />
          </View>
        </Pressable>
        {isOpen ? (
          <View style={styles.cardBody}>
            <GoalFormFields
              form={form}
              onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
              errors={errors}
              today={today}
              savedMinor={editing?.savedMinor ?? 0}
              firstMonth={[today.slice(0, 7), editing?.deadline ?? '9999-12'].sort()[0]!}
              testID={`savings.setup.${id}`}
            />
            {failure ? (
              <AppText variant="small" color="danger" accessibilityLiveRegion="polite">
                {failure}
              </AppText>
            ) : null}
            <PrimaryButton
              label={t.save}
              onPress={() => void save()}
              loading={busy}
              testID={`savings.setup.${id}.save`}
            />
            {editing ? (
              <GhostButton
                label={t.delete}
                tone="danger"
                icon="trash"
                disabled={busy}
                onPress={() => void remove(editing.id)}
                testID={`savings.setup.${id}.delete`}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    );

    const categoryOf = (c: GoalSummary['category']) => savingsStrings.categories[c];

    return (
      <View style={styles.list} testID="savings.setup">
        {(goals ?? []).map((g) =>
          card(
            g.id,
            g.name,
            t.summary(categoryOf(g.category), formatCop(g.targetMinor)),
            open === g.id,
          ),
        )}
        {open === NEW
          ? card(
              NEW,
              form.name.trim() || t.newGoal,
              t.summary(categoryOf(form.category), form.target ? `$${form.target}` : '$0'),
              true,
            )
          : null}
        {goals !== null && open !== NEW ? (
          <Pressable
            onPress={() => openCard(NEW)}
            accessibilityRole="button"
            style={styles.add}
            testID="savings.setup.add"
          >
            <Icon name="plus" size={18} color={colors.primaryDeep} />
            <AppText variant="bodyStrong" style={{ color: colors.primaryDeep }}>
              {goals.length === 0 ? t.addFirst : t.add}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    );
  };
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    list: { gap: spacing.md },
    card: {
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
      overflow: 'hidden',
      ...shadow.card,
    },
    cardOpen: { borderColor: colors.borderBlueStrong },
    flipped: { transform: [{ rotate: '180deg' }] },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    cardText: { flexGrow: 1, flexShrink: 1, minWidth: 0, gap: 2 },
    cardBody: {
      gap: spacing.section,
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.borderBlue,
    },
    // "Agregar otra meta": dashed primary border on the soft blue surface (OnbMetas).
    add: {
      height: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      borderRadius: radius.button,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.primary,
      backgroundColor: colors.surfaceBlueSoft,
    },
  });
