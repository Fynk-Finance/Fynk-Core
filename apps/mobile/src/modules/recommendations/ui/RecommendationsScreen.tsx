// Recomendaciones (tab, Recomendaciones.html): "Mayor impacto", the donut of possible savings,
// filters, the numbered next steps and the disclaimer, always visible (HU-024, HU-025, HU-026).
// No transport plan and no "Ver plan". Every number comes from M10's opportunities.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { categoryLabel, formatCop } from '@shared/domain';
import {
  AmountText,
  AppText,
  Chip,
  Donut,
  EmptyState,
  ErrorState,
  HeaderBlue,
  Icon,
  Screen,
  Skeleton,
  fonts,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type ColorToken,
  type IconName,
  type Theme,
} from '@shared/ui';
import { savingOpportunities, totalMonthlySaving, useOpenCapForm } from '@modules/analytics';

import { useRecommendations } from '../application/hooks';
import type { RecommendationsView } from '../application/recommendationsService';
import {
  buildSteps,
  filterSteps,
  highlight,
  shortDate,
  summaryText,
  type StepAction,
  type StepFilter,
  type ViewStep,
} from '../domain/steps';
import { recommendationsStrings as s, stepCopy } from './strings.es-CO';

/** Where "Programar" and "Revisar" go. M8 and M9 own those screens. */
export interface RecommendationsNavigation {
  openPaydayReminder: (
    nav: NavigationProp<ParamListBase>,
    goalId: string,
    amountMinor: number,
  ) => void;
  openLowUseSubscriptions: (nav: NavigationProp<ParamListBase>) => void;
  useDisplayName: () => string;
}

export const defaultNavigation: RecommendationsNavigation = {
  // Until M8 exports openPaydayReminder: its goals screen with the goal and amount as params.
  openPaydayReminder: (nav, goalId, amountMinor) =>
    nav.navigate('savings.Goals', { goalId, paydayAmountMinor: amountMinor }),
  // Billetera (M9) with the low use filter.
  openLowUseSubscriptions: (nav) => nav.navigate('Billetera', { filter: 'low_use' }),
  useDisplayName: () => s.guestName,
};

// Donut and legend colors in the order of the design: #50c1eb, #a8e03a, #1f93c2.
const LEGEND: readonly ColorToken[] = [
  'primaryLight',
  'accent',
  'primaryDark',
  'primaryDeep',
  'accentStroke',
];

export function createRecommendationsScreen(
  navigationTargets: RecommendationsNavigation = defaultNavigation,
) {
  return function RecommendationsScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const openCapForm = useOpenCapForm();
    const name = navigationTargets.useDisplayName();
    const { query, refresh, unavailable } = useRecommendations();
    const [filter, setFilter] = useState<StepFilter>('all');
    const view = query.data;

    const run = (action: StepAction) => {
      if (action.kind === 'cap') openCapForm(action.categoryId, action.suggestedMinor);
      else if (action.kind === 'payday')
        navigationTargets.openPaydayReminder(navigation, action.goalId, action.amountMinor);
      else navigationTargets.openLowUseSubscriptions(navigation);
    };

    const top = view ? highlight(view.opportunities, stepCopy) : null;

    return (
      <Screen
        withTabBar
        padded={false}
        gap={0}
        testID="recommendations.screen"
        header={
          <HeaderBlue name={name} title={s.title}>
            {top ? (
              <Pressable
                onPress={() => run(top.action)}
                accessibilityRole="button"
                accessibilityLabel={s.highlightLabel(top.title, formatCop(top.amountMinor))}
                testID="recommendations.highlight"
                style={({ pressed }) => [styles.highlight, pressed ? styles.pressed : null]}
              >
                <View style={styles.highlightBody}>
                  <View style={styles.badge}>
                    <AppText style={styles.badgeText} color="onPrimary">
                      {s.highlightBadge}
                    </AppText>
                  </View>
                  <AppText variant="cardTitle" color="onPrimary">
                    {top.title}
                  </AppText>
                  <View style={styles.amountRow}>
                    <AmountText amountMinor={top.amountMinor} size={18} color="onPrimary" />
                    <AppText variant="captionStrong" color="onPrimary">
                      {s.perMonth}
                    </AppText>
                  </View>
                </View>
                <View style={styles.go}>
                  <Icon
                    name="chevronRight"
                    size={20}
                    strokeWidth={2.4}
                    color={colors.primaryDark}
                  />
                </View>
              </Pressable>
            ) : null}
          </HeaderBlue>
        }
      >
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refresh.isPending}
              onRefresh={() => refresh.mutate()}
              tintColor={colors.primary}
            />
          }
          testID="recommendations.scroll"
        >
          {unavailable || (view && view.opportunities.length === 0) ? (
            <EmptyState icon="chartLine" title={s.empty} message={s.emptyHint} />
          ) : query.isError ? (
            <ErrorState message={s.error} onRetry={() => void query.refetch()} />
          ) : !view ? (
            <Skeleton height={180} />
          ) : (
            <Body view={view} filter={filter} onFilter={setFilter} onAction={run} />
          )}
          {/* HU-026: next to the result, in every render path. */}
          <View style={styles.disclaimer} testID="recommendations.disclaimer">
            <Icon name="shield" size={18} color={colors.primaryDark} />
            <AppText variant="small" color="textBody" style={styles.flex}>
              {s.disclaimer}
            </AppText>
          </View>
        </ScrollView>
      </Screen>
    );
  };
}

function Body({
  view,
  filter,
  onFilter,
  onAction,
}: {
  view: RecommendationsView;
  filter: StepFilter;
  onFilter: (f: StepFilter) => void;
  onAction: (a: StepAction) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const savings = savingOpportunities(view.opportunities);
  const total = totalMonthlySaving(view.opportunities);
  const steps = useMemo(() => buildSteps(view.opportunities, view.texts, stepCopy), [view]);
  const shown = filterSteps(steps, filter);
  const summary = summaryText(view.texts, total, savings.length, stepCopy);
  const filters: [StepFilter, string][] = [
    ['all', s.filters.all],
    ['expenses', s.filters.expenses],
    ['savings', s.filters.savings],
    ['subscriptions', s.filters.subscriptions],
  ];

  return (
    <>
      {savings.length > 0 ? (
        <View
          style={styles.potential}
          accessibilityLabel={s.donutLabel(formatCop(total), savings.length)}
        >
          <Donut
            size={140}
            radius={54}
            segments={savings.map((o, i) => ({
              value: o.monthlyMinor,
              color: LEGEND[i % LEGEND.length] ?? 'primary',
            }))}
            accessibilityLabel={s.donutLabel(formatCop(total), savings.length)}
          >
            <AmountText amountMinor={total} size={18} testID="recommendations.total" />
            <AppText variant="caption" color="textSecondary">
              {s.perMonth}
            </AppText>
          </Donut>
          <View style={styles.legend}>
            <AppText variant="smallStrong">{s.fronts(savings.length)}</AppText>
            {savings.map((o, i) => (
              <View key={o.factKey} style={styles.legendRow}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors[LEGEND[i % LEGEND.length] ?? 'primary'] },
                  ]}
                />
                <AppText variant="caption" color="textSecondary" style={styles.flex}>
                  {o.kind === 'subscriptions'
                    ? stepCopy.titles.subscriptions
                    : categoryLabel(o.categoryId ?? 'other')}
                </AppText>
                <AmountText amountMinor={o.monthlyMinor} size={12} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        accessibilityLabel={s.filters.label}
      >
        {filters.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={filter === value}
            onPress={() => onFilter(value)}
            testID={`recommendations.filter.${value}`}
          />
        ))}
      </ScrollView>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="section" accessibilityRole="header">
            {s.nextSteps}
          </AppText>
          <AppText variant="captionStrong" color="textSecondary">
            {s.suggestions(shown.length)}
          </AppText>
        </View>
        <AppText variant="body" color="textBody" testID="recommendations.summary">
          {summary.text}
        </AppText>
        <AppText variant="caption" color="textSecondary" testID="recommendations.basedOn">
          {s.basedOn(shortDate(view.dataRange.from), shortDate(view.dataRange.to))}
          {summary.fromModel ? ` ${s.writtenBy}` : ''}
        </AppText>
        {view.notice !== 'none' ? (
          <AppText variant="caption" color="textSecondary" testID="recommendations.notice">
            {view.notice === 'ai_off'
              ? s.aiOff
              : view.notice === 'rate_limited'
                ? s.rateLimited
                : s.offline}
          </AppText>
        ) : null}
        <View>
          {shown.map((step, i) => (
            <StepRow
              key={step.factKey}
              step={step}
              last={i === shown.length - 1}
              onAction={onAction}
            />
          ))}
        </View>
      </View>
    </>
  );
}

const ACTION_LABEL: Record<StepAction['kind'], string> = {
  cap: s.actions.cap,
  payday: s.actions.payday,
  subscriptions: s.actions.subscriptions,
};

function StepRow({
  step,
  last,
  onAction,
}: {
  step: ViewStep;
  last: boolean;
  onAction: (a: StepAction) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.step} testID={`recommendations.step.${step.factKey}`}>
      <View style={styles.rail}>
        <View style={styles.number}>
          <AppText style={styles.numberText} color="onPrimary">
            {String(step.number)}
          </AppText>
        </View>
        {last ? null : <View style={styles.line} />}
      </View>
      <View style={styles.stepBody}>
        <View style={styles.stepTitle}>
          <Icon name={step.icon as IconName} size={20} color={colors.primaryDark} />
          <AppText variant="bodyStrong">{step.title}</AppText>
          <View style={styles.tag}>
            <AppText style={styles.tagText} color="link">
              {s.tags[step.tag]}
            </AppText>
          </View>
        </View>
        <AppText variant="small" color="textSecondary">
          {step.text}
        </AppText>
        <View style={styles.stepFooter}>
          <AppText variant="smallStrong" color="link" style={styles.flex}>
            {step.saving}
          </AppText>
          <Pressable
            onPress={() => onAction(step.action)}
            accessibilityRole="button"
            accessibilityLabel={`${ACTION_LABEL[step.action.kind]}: ${step.title}`}
            testID={`recommendations.action.${step.factKey}`}
            style={({ pressed }) => [styles.apply, pressed ? styles.applyPressed : null]}
          >
            <AppText style={styles.applyText} color="onPrimary">
              {ACTION_LABEL[step.action.kind]}
            </AppText>
            <Icon name="arrowRight" size={16} strokeWidth={2.4} color={colors.onPrimary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles({ colors, shadow }: Theme) {
  return StyleSheet.create({
    content: { padding: 16, paddingTop: 24, paddingBottom: spacing.tabBarClearance, gap: 16 },
    highlight: {
      marginTop: 2,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      minHeight: 137,
      padding: 16,
      borderRadius: radius.cardLg,
      backgroundColor: colors.primaryLight,
      overflow: 'hidden',
      ...shadow.card,
    },
    highlightBody: { flex: 1, gap: 4 },
    badge: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.onPrimaryBadge,
    },
    badgeText: {
      fontFamily: fonts.body.bold,
      fontSize: 10,
      lineHeight: 13,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    go: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    potential: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      padding: 16,
      borderRadius: radius.sheetSm,
      backgroundColor: colors.surfaceBlueSoft,
      borderWidth: 1,
      borderColor: colors.borderBlue,
    },
    legend: { flex: 1, gap: 8 },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    legendDot: { width: 10, height: 10, borderRadius: 4 },
    chips: { gap: 8 },
    section: { gap: 8 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    step: { flexDirection: 'row', gap: 8 },
    rail: { width: 32, alignItems: 'center' },
    number: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    numberText: { fontFamily: fonts.heading.bold, fontSize: 14, lineHeight: 18 },
    line: { flex: 1, width: 2, minHeight: 16, backgroundColor: colors.borderBlue },
    stepBody: { flex: 1, gap: 8, paddingTop: 8, paddingBottom: 16 },
    stepTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tag: {
      marginLeft: 'auto',
      paddingVertical: 2,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.accentTint,
    },
    tagText: { fontFamily: fonts.body.bold, fontSize: 10, lineHeight: 13 },
    stepFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    apply: {
      height: 40,
      paddingHorizontal: 16,
      borderRadius: radius.tile,
      backgroundColor: colors.accent,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    applyPressed: { backgroundColor: colors.accentPressed },
    applyText: { fontFamily: fonts.body.bold, fontSize: 13, lineHeight: 18 },
    disclaimer: {
      flexDirection: 'row',
      gap: 8,
      padding: 14,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceBlueSoft,
      borderWidth: 1,
      borderColor: colors.borderBlue,
    },
    flex: { flex: 1 },
    pressed: { opacity: 0.9 },
  });
}
