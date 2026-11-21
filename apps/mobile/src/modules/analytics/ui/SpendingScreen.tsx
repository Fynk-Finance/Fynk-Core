// Estadísticas (design screen 14, Estadisticas.html), opened from the Dashboard chart icon and the
// "Gastos" pill: the blue summary card that shrinks while the page scrolls, "Gastos por
// categoría" (a tap opens M7's list filtered), "Tus estadísticas", "Por día de la semana" and
// "Dónde más gastas". Under the design, for HU-022, HU-023 and HU-043 (new sections, need design
// review): Tendencias (3, 6 or 12 months), Ingresos recurrentes and the way into Topes.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryLabel, type CategoryId } from '@shared/domain';
import {
  AmountText,
  AppText,
  Badge,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  Icon,
  LineChart,
  SectionHeader,
  Skeleton,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import {
  useAnalyticsService,
  useRecurringIncome,
  useSpendByCategory,
  useStatistics,
  useTrend,
} from '../application/hooks';
import { periodRange } from '../domain/periods';
import type { StatsPeriod } from '../domain/statistics';
import { CAPS_ROUTE } from './CapsScreen';
import { CARD_HEIGHT, CARD_SHRINK, SummaryCard } from './statistics/SummaryCard';
import { CategoriesCard, StatTiles, TopPlaces, WeekdayCard } from './statistics/Sections';
import { analyticsStrings } from './strings.es-CO';

const s = analyticsStrings;
const t = analyticsStrings.statistics;

/** Route of M7's movements list; it reads `categoryId`, `from` and `to` to filter. */
export const TRANSACTIONS_ROUTE = 'transactions.All';

/** The design's scroll content starts 21 px under the open card (584 − 563). */
const CONTENT_GAP = 21;

export function SpendingScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const query = useStatistics(period);
  const view = query.data;

  const progress = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    progress.value = Math.min(1, Math.max(0, e.contentOffset.y / CARD_SHRINK));
  });

  const back = () => (navigation.canGoBack() ? navigation.goBack() : undefined);

  return (
    <View style={styles.root} testID="analytics.spending">
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + CARD_HEIGHT + CONTENT_GAP, paddingBottom: insets.bottom + 40 },
        ]}
      >
        {query.unavailable ? (
          <EmptyState icon="chartLine" title={s.spending.empty} message={s.spending.emptyHint} />
        ) : query.isError ? (
          <ErrorState message={s.errors.load} onRetry={() => void query.refetch()} />
        ) : !view ? (
          <Skeleton height={220} />
        ) : (
          <>
            {view.byCategory.categories.length === 0 ? (
              <EmptyState icon="chartLine" title={t.empty} message={s.spending.emptyHint} />
            ) : (
              <CategoriesCard
                data={view.byCategory}
                periodLabel={t.lastDays[period]}
                onOpen={(categoryId: CategoryId) =>
                  navigation.navigate(TRANSACTIONS_ROUTE, {
                    categoryId,
                    from: view.summary.range.from,
                    to: view.summary.range.to,
                  })
                }
              />
            )}
            <StatTiles
              stats={view.stats}
              periodLabel={t.lastDays[period]}
              previousLabel={t.previousOf[period]}
            />
            <WeekdayCard pattern={view.weekdays} />
            <TopPlaces places={view.places} />
          </>
        )}
        <Pressable
          onPress={() => navigation.navigate(CAPS_ROUTE)}
          accessibilityRole="button"
          accessibilityLabel={`${t.caps}. ${t.capsHint}`}
          testID="analytics.statistics.caps"
          style={({ pressed }) => [styles.capsRow, pressed ? styles.pressed : null]}
        >
          <View style={styles.capsIcon}>
            <Icon name="goal" size={18} color={colors.primaryDark} />
          </View>
          <View style={styles.flex}>
            <AppText variant="label">{t.caps}</AppText>
            <AppText variant="caption" color="textSecondary">
              {t.capsHint}
            </AppText>
          </View>
          <Icon name="chevronRight" size={20} color={colors.textSecondary} />
        </Pressable>
        <TrendsSection />
        <RecurringIncomeSection />
      </Animated.ScrollView>
      <SummaryCard
        summary={view?.summary ?? null}
        period={period}
        onPeriod={setPeriod}
        onBack={back}
        progress={progress}
      />
    </View>
  );
}

function TrendsSection() {
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();
  const [months, setMonths] = useState(6);
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const service = useAnalyticsService();
  const today = service?.today() ?? null;
  const top = useSpendByCategory(today ? periodRange('last_3_months', today) : null);
  const query = useTrend(category, months);
  const what = category === 'all' ? s.trends.all : categoryLabel(category);
  const change = query.data?.changePercent ?? null;

  return (
    <View style={styles.block} testID="analytics.trends">
      <SectionHeader title={t.trends} />
      <View style={styles.chips}>
        {[3, 6, 12].map((m) => (
          <Chip
            key={m}
            label={s.trends.months(m)}
            selected={months === m}
            onPress={() => setMonths(m)}
            testID={`analytics.trend.months.${m}`}
          />
        ))}
      </View>
      <View style={styles.chips}>
        <Chip
          label={s.trends.all}
          selected={category === 'all'}
          onPress={() => setCategory('all')}
          testID="analytics.trend.category.all"
        />
        {(top.data?.categories ?? []).slice(0, 5).map((c) => (
          <Chip
            key={c.categoryId}
            label={categoryLabel(c.categoryId)}
            selected={category === c.categoryId}
            onPress={() => setCategory(c.categoryId)}
            testID={`analytics.trend.category.${c.categoryId}`}
          />
        ))}
      </View>
      {query.unavailable ? (
        <EmptyState icon="chartLine" title={s.spending.empty} message={s.spending.emptyHint} />
      ) : query.isError ? (
        <ErrorState message={s.errors.load} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <Skeleton height={160} />
      ) : (
        <Card style={styles.block}>
          <View style={styles.rowTop}>
            <AppText variant="cardTitle">{what}</AppText>
            <Badge
              label={change === null ? s.trends.noChange : s.trends.change(change)}
              tone={change !== null && change > 0 ? 'info' : 'success'}
              testID="analytics.trend.change"
            />
          </View>
          <AmountText
            amountMinor={query.data.points.at(-1)?.amountMinor ?? 0}
            size={22}
            testID="analytics.trend.last"
          />
          <LineChart
            key={`${category}-${months}`}
            values={query.data.points.map((p) => p.amountMinor)}
            width={width - spacing.screen * 4}
            accessibilityLabel={s.trends.chartLabel(what, months)}
          />
        </Card>
      )}
    </View>
  );
}

function RecurringIncomeSection() {
  const styles = useThemedStyles(createStyles);
  const query = useRecurringIncome();
  const sources = query.data ?? [];
  return (
    <View style={styles.block} testID="analytics.income">
      <SectionHeader title={s.income.title} />
      {sources.length === 0 ? (
        <AppText variant="small" color="textSecondary">
          {s.income.empty}
        </AppText>
      ) : (
        <Card style={styles.list}>
          {sources.map((src) => (
            <View
              key={src.sourceKey}
              style={styles.row}
              testID={`analytics.income.${src.sourceKey}`}
            >
              <View style={styles.rowBody}>
                <View style={styles.rowTop}>
                  <AppText variant="label" numberOfLines={1} style={styles.flex}>
                    {src.label}
                  </AppText>
                  <AmountText amountMinor={src.estimatedMonthlyMinor} size={15} />
                </View>
                <AppText variant="caption" color="textSecondary">
                  {`${src.cadence === 'monthly' ? s.income.monthly : s.income.biweekly} · ${s.income.usualDay(src.usualDay)} · ${s.income.estimated}`}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function createStyles(theme: Theme) {
  const { colors } = theme;
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    // Estadisticas.html: 16 px sides, 24 px between sections.
    content: { paddingHorizontal: 16, gap: 24 },
    capsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xl,
      padding: spacing.xl,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
    },
    capsIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.surfaceBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    block: { gap: spacing.xl },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    donutCard: { alignItems: 'center', gap: spacing.xl, paddingVertical: spacing.block },
    list: { paddingVertical: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xl,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.xl,
    },
    rowBody: { flex: 1, gap: spacing.xs },
    rowTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    flex: { flex: 1 },
    pressed: { backgroundColor: colors.surfaceBlueSoft },
  });
}
