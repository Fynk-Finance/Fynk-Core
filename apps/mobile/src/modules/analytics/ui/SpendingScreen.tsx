// Gastos por categoría (new screen from the Dashboard "Gastos" pill, needs design review). Built
// from shared components in the style of Estadisticas: period control, donut in the
// Recomendaciones style, categories with share and a mini bar, a Tendencias tab with the line
// chart of Inversión, and the recurring income section (HU-021, HU-022, HU-023).
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { categoryLabel, formatCop, type CategoryId } from '@shared/domain';
import {
  AmountText,
  AppText,
  Badge,
  Card,
  Chip,
  Donut,
  EmptyState,
  ErrorState,
  Icon,
  LineChart,
  ProgressBar,
  Screen,
  SectionHeader,
  SegmentedControl,
  Skeleton,
  TextField,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import {
  useAnalyticsService,
  useRecurringIncome,
  useSpendByCategory,
  useTrend,
} from '../application/hooks';
import { periodRange, rangeDays, type SpendingPeriod } from '../domain/periods';
import { dailyAverageMinor } from '../domain/spending';
import { segmentColor } from './chartColors';
import { analyticsStrings } from './strings.es-CO';

const s = analyticsStrings;

/** Route of M7's movements list; it reads `categoryId`, `from` and `to` to filter. */
export const TRANSACTIONS_ROUTE = 'transactions.All';

type Tab = 'categories' | 'trends';

export function SpendingScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('categories');

  return (
    <Screen scroll gap={spacing.section} testID="analytics.spending">
      <View style={styles.top}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          testID="analytics.spending.back"
          hitSlop={12}
        >
          <Icon name="chevronLeft" size={24} strokeWidth={2.4} color={colors.primaryDark} />
        </Pressable>
        <AppText variant="screenTitle" accessibilityRole="header">
          {s.spending.title}
        </AppText>
      </View>
      <SegmentedControl
        options={[
          { value: 'categories', label: s.spending.tabs.categories },
          { value: 'trends', label: s.spending.tabs.trends },
        ]}
        value={tab}
        onChange={setTab}
        accessibilityLabel={s.spending.title}
        testID="analytics.spending.tabs"
      />
      {tab === 'categories' ? <CategoriesTab /> : <TrendsTab />}
      <RecurringIncomeSection />
    </Screen>
  );
}

function CategoriesTab() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const service = useAnalyticsService();
  const [period, setPeriod] = useState<SpendingPeriod>('this_month');
  const [custom, setCustom] = useState({ from: '', to: '' });
  const today = service?.today() ?? null;
  const range = useMemo(
    () => (today ? periodRange(period, today, custom) : null),
    [today, period, custom],
  );
  const query = useSpendByCategory(range);
  const periods: [SpendingPeriod, string][] = [
    ['this_month', s.spending.periods.thisMonth],
    ['last_month', s.spending.periods.lastMonth],
    ['last_3_months', s.spending.periods.last3Months],
    ['custom', s.spending.periods.custom],
  ];

  const data = query.data;
  return (
    <View style={styles.block}>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {periods.map(([value, label]) => (
          <Chip
            key={value}
            label={label}
            selected={period === value}
            onPress={() => setPeriod(value)}
            testID={`analytics.period.${value}`}
          />
        ))}
      </View>
      {period === 'custom' ? (
        <View style={styles.block}>
          <TextField
            label={s.spending.customFrom}
            value={custom.from}
            onChangeText={(from) => setCustom((c) => ({ ...c, from }))}
            autoCapitalize="none"
            testID="analytics.custom.from"
          />
          <TextField
            label={s.spending.customTo}
            value={custom.to}
            onChangeText={(to) => setCustom((c) => ({ ...c, to }))}
            autoCapitalize="none"
            error={custom.from && custom.to && !range ? s.spending.customInvalid : undefined}
            testID="analytics.custom.to"
          />
        </View>
      ) : null}

      {query.unavailable || (data && data.categories.length === 0) ? (
        <EmptyState icon="chartLine" title={s.spending.empty} message={s.spending.emptyHint} />
      ) : query.isError ? (
        <ErrorState message={s.errors.load} onRetry={() => void query.refetch()} />
      ) : !data ? (
        range ? (
          <Skeleton height={220} />
        ) : null
      ) : (
        <>
          <Card style={styles.donutCard}>
            <Donut
              segments={data.categories.map((c, i) => ({
                value: c.amountMinor,
                color: segmentColor(i),
              }))}
              accessibilityLabel={s.spending.donutLabel(formatCop(data.totalMinor))}
            >
              <AppText variant="caption" color="textSecondary">
                {s.spending.total}
              </AppText>
              <AmountText amountMinor={data.totalMinor} size={22} testID="analytics.total" />
            </Donut>
            <AppText variant="small" color="textSecondary" testID="analytics.dailyAverage">
              {`${s.spending.dailyAverage}: ${formatCop(
                dailyAverageMinor(data.totalMinor, rangeDays(data)),
              )}`}
            </AppText>
          </Card>
          <Card style={styles.list}>
            {data.categories.map((c, i) => (
              <Pressable
                key={c.categoryId}
                onPress={() =>
                  navigation.navigate(TRANSACTIONS_ROUTE, {
                    categoryId: c.categoryId,
                    from: data.from,
                    to: data.to,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`${categoryLabel(c.categoryId)}, ${formatCop(c.amountMinor)}, ${c.sharePercent} %`}
                testID={`analytics.category.${c.categoryId}`}
                style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
              >
                {/* Same token as the donut segment of the row. */}
                <View style={[styles.dot, { backgroundColor: colors[segmentColor(i)] }]} />
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <AppText variant="label">{categoryLabel(c.categoryId)}</AppText>
                    <AmountText amountMinor={c.amountMinor} size={15} />
                  </View>
                  <AppText variant="caption" color="textSecondary">
                    {s.spending.categoryRow(c.sharePercent, c.count)}
                  </AppText>
                  <ProgressBar progress={c.sharePercent / 100} height={4} />
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      )}
    </View>
  );
}

function TrendsTab() {
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
    <View style={styles.block}>
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
    top: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
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
    pressed: { opacity: 0.7 },
  });
}
