// Metas de ahorro (design Metas, inventory row 15; SCRUM-51). Pushed with the default transition
// from the Dashboard's "Ver todos". Blue header, the stats card over it, "Próximas metas · Por
// fecha límite" with the goals that are not reached yet (tap to expand), "Metas cumplidas"
// with the reached ones, and the extended "Nueva meta" FAB that opens the goal form.
// The design's "Ver todas las metas (5)" link is left out: the list already shows every goal.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatCop } from '@shared/domain/money';
import type { MoneyMinor } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  EmptyState,
  ErrorState,
  Fab,
  Icon,
  SectionHeader,
  Skeleton,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { GoalService } from '../application/goalService';
import type { GoalSummary } from '../domain/goal';
import { GoalCard } from './GoalCard';
import { GOAL_FORM_ROUTE } from './GoalFormScreen';
import { GOAL_ICONS } from './goalIcons';
import { MetasHeader } from './MetasHeader';
import { MetasStats } from './MetasStats';
import { MONTHS_SHORT, savingsStrings } from './strings.es-CO';
import { useGoals } from './useGoals';

const t = savingsStrings.metas;

export const METAS_ROUTE = 'savings.Goals' as const;

export interface MetasDeps {
  service: GoalService;
  /** Monthly income for "23 % de tus ingresos" (M10). Null until it is available. */
  monthlyIncome: () => Promise<MoneyMinor | null>;
}

/** "ago 2026" from '2026-08-20'. */
const doneMonth = (date: string) =>
  `${MONTHS_SHORT[Number(date.slice(5, 7)) - 1]!.toLowerCase()} ${date.slice(0, 4)}`;

export function createMetasScreen({ service, monthlyIncome }: MetasDeps) {
  return function MetasScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const insets = useSafeAreaInsets();
    const { state, reload } = useGoals(service, monthlyIncome);
    const [open, setOpen] = useState<string | null>(null);

    const create = () => navigation.navigate(GOAL_FORM_ROUTE);
    const edit = (goal: GoalSummary) => navigation.navigate(GOAL_FORM_ROUTE, { id: goal.id });
    const upcoming = state.status === 'ready' ? state.goals.filter((g) => !g.done) : [];
    const done = state.status === 'ready' ? state.goals.filter((g) => g.done) : [];

    return (
      <View style={styles.root} testID="savings.metas">
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 112 }}
          showsVerticalScrollIndicator={false}
        >
          <MetasHeader activeCount={upcoming.length} onBack={() => navigation.goBack()} />

          {state.status === 'loading' ? (
            <View style={styles.section}>
              <Skeleton height={150} radius={22} />
              <Skeleton height={110} radius={radius.tile} />
            </View>
          ) : state.status === 'error' ? (
            <View style={styles.section}>
              <ErrorState message={t.error} onRetry={() => void reload()} />
            </View>
          ) : state.goals.length === 0 ? (
            <View style={styles.section}>
              <EmptyState
                title={t.emptyTitle}
                message={t.emptyMessage}
                icon="goal"
                actionLabel={t.emptyAction}
                onAction={create}
              />
            </View>
          ) : (
            <>
              <MetasStats overview={state.overview} incomeMinor={state.incomeMinor} />

              {upcoming.length > 0 ? (
                <View style={styles.section} testID="savings.metas.upcoming">
                  <SectionHeader
                    title={t.upcoming}
                    meta={
                      <AppText variant="captionStrong" color="textSecondary">
                        {t.byDeadline}
                      </AppText>
                    }
                  />
                  {upcoming.map((goal) => (
                    <GoalCard
                      key={goal.id}
                      goal={goal}
                      expanded={open === goal.id}
                      onToggle={() => setOpen((id) => (id === goal.id ? null : goal.id))}
                      onEdit={() => edit(goal)}
                    />
                  ))}
                </View>
              ) : null}

              {done.length > 0 ? <DoneSection goals={done} onPress={edit} /> : null}
            </>
          )}
        </ScrollView>

        <Fab
          label={t.fab}
          accessibilityLabel={t.fabLabel}
          onPress={create}
          style={{ ...styles.fab, bottom: insets.bottom + 24 }}
          testID="savings.metas.fab"
        />
      </View>
    );
  };
}

/** "Metas cumplidas · 3 metas", the lime banner and the timeline of reached goals. */
function DoneSection({
  goals,
  onPress,
}: {
  goals: GoalSummary[];
  onPress: (goal: GoalSummary) => void;
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const total = goals.reduce((sum, g) => sum + g.savedMinor, 0);
  return (
    <View style={styles.section} testID="savings.metas.done">
      <SectionHeader
        title={t.doneTitle}
        meta={
          <AppText variant="captionStrong" color="textSecondary">
            {t.doneCount(goals.length)}
          </AppText>
        }
      />
      <View style={styles.banner}>
        <View style={styles.bannerTile}>
          <Icon name="check" size={22} color={colors.onPrimary} />
        </View>
        <View style={styles.texts}>
          <AppText variant="smallStrong">{t.doneBanner(formatCop(total))}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t.doneCheer}
          </AppText>
        </View>
      </View>
      {goals.map((goal, i) => {
        const category = savingsStrings.categories[goal.category];
        return (
          <View key={goal.id} style={styles.doneRow} testID={`savings.done.${goal.id}`}>
            <View style={styles.rail}>
              <View style={styles.doneTile}>
                <Icon name={GOAL_ICONS[goal.category]} size={20} color={colors.accentText} />
              </View>
              <View style={[styles.line, i === goals.length - 1 ? styles.lineEnd : null]} />
            </View>
            <View style={styles.doneText}>
              <View style={styles.texts}>
                <AppText
                  variant="smallStrong"
                  numberOfLines={1}
                  onPress={() => onPress(goal)}
                  accessibilityRole="button"
                >
                  {goal.name}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {goal.completedOn
                    ? t.doneOn(category, doneMonth(goal.completedOn))
                    : t.doneNoDate(category)}
                </AppText>
              </View>
              <AmountText amountMinor={goal.targetMinor} size={14} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    section: { paddingHorizontal: 16, paddingTop: 24, gap: spacing.md },
    fab: { position: 'absolute', right: 16 },
    // "Has ahorrado $5.500.000 en metas cumplidas": lime tinted, as in the design.
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.accentSoft,
      backgroundColor: colors.accentSurface,
    },
    bannerTile: {
      width: 40,
      height: 40,
      borderRadius: 11,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    texts: { flexShrink: 1, minWidth: 0, gap: 2 },
    doneRow: { flexDirection: 'row', gap: spacing.md },
    rail: { width: 40, alignItems: 'center' },
    doneTile: {
      width: 40,
      height: 40,
      borderRadius: 11,
      backgroundColor: colors.accentTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    line: { flexGrow: 1, width: 2, minHeight: 16, backgroundColor: colors.borderBlue },
    lineEnd: { backgroundColor: 'transparent' },
    doneText: {
      flexGrow: 1,
      flexShrink: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.md,
      paddingTop: 2,
      paddingBottom: 16,
    },
  });
