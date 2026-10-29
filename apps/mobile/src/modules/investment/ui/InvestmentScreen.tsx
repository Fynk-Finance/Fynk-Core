// Inversión (tab, Inversion.html adapted): the user's own CDTs with their total over time, tiles,
// "Tus inversiones", Explorar, the calculator, the Banco de la República reference and the
// disclaimer, always visible (HU-049). It informs, it never advises.
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { formatCop } from '@shared/domain';
import {
  AmountText,
  AppText,
  Badge,
  HeaderBlue,
  Icon,
  LineChart,
  Screen,
  SectionHeader,
  fonts,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { useInvestmentDeps, useOwnCdts } from '../application/hooks';
import {
  chartPoints,
  formatRate,
  holdingsFrom,
  portfolioSummary,
  shortDate,
  termLabel,
  type ChartPeriod,
} from '../domain/investment';
import { ExploreSection } from './ExploreSection';
import { investmentStrings as s } from './strings.es-CO';

const PERIODS: ChartPeriod[] = ['1M', '3M', '1A', 'Todo'];

export function createInvestmentScreen(useDisplayName: () => string = () => s.guestName) {
  return function InvestmentScreen() {
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const { width } = useWindowDimensions();
    const deps = useInvestmentDeps();
    const own = useOwnCdts();
    const [period, setPeriod] = useState<ChartPeriod>('1A');
    const name = useDisplayName();

    const today = deps ? deps.clock.now().toISOString().slice(0, 10) : '1970-01-01';
    const holdings = holdingsFrom(own.data?.accounts ?? []);
    const summary = portfolioSummary(holdings, today);
    const points = chartPoints(own.data?.history ?? [], period, today);

    const invest = () => {
      if (deps) void Linking.openURL(deps.portalUrl);
    };

    return (
      <Screen
        scroll
        withTabBar
        padded={false}
        gap={spacing.block}
        testID="investment.screen"
        header={
          <HeaderBlue name={name}>
            <View style={styles.hero}>
              <AppText variant="subtitle" color="onPrimary" style={styles.heroLabel}>
                {s.headerLabel}
              </AppText>
              <AmountText
                amountMinor={summary.totalMinor}
                size={38}
                color="onPrimary"
                testID="investment.total"
              />
              {points.length > 1 ? (
                <LineChart
                  values={points.map((p) => p.balanceMinor)}
                  width={width - spacing.screen * 2}
                  height={96}
                  color={colors.onPrimary}
                  accessibilityLabel={s.chartLabel(formatCop(summary.totalMinor))}
                />
              ) : null}
              <View
                style={styles.periods}
                accessibilityRole="radiogroup"
                accessibilityLabel={s.periodLabel}
              >
                {PERIODS.map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setPeriod(p)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: period === p }}
                    testID={`investment.period.${p}`}
                    style={[styles.period, period === p ? styles.periodOn : null]}
                  >
                    <AppText
                      style={styles.periodText}
                      color={period === p ? 'primaryDark' : 'onPrimary'}
                    >
                      {s.periods[p]}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          </HeaderBlue>
        }
      >
        <View style={styles.tiles}>
          <Tile label={s.tiles.yearInterest(summary.year)} testID="investment.tile.interest">
            <AmountText amountMinor={summary.yearInterestMinor} signed size={17} color="link" />
          </Tile>
          <Tile label={s.tiles.averageRate} testID="investment.tile.rate">
            <AppText style={styles.tileValue}>
              {summary.averageRateBps === null ? s.tiles.none : formatRate(summary.averageRateBps)}
            </AppText>
          </Tile>
          <Tile label={s.tiles.nextMaturity} testID="investment.tile.maturity">
            <AppText style={styles.tileValue}>
              {summary.nextMaturity ? shortDate(summary.nextMaturity) : s.tiles.none}
            </AppText>
          </Tile>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title={s.holdings.title}
            actionLabel={s.holdings.invest}
            onAction={deps ? invest : undefined}
          />
          <AppText variant="caption" color="textSecondary">
            {s.holdings.investHint}
          </AppText>
          {holdings.length === 0 ? (
            <AppText variant="small" color="textSecondary" testID="investment.holdings.empty">
              {s.holdings.empty}
            </AppText>
          ) : (
            holdings.map((h) => (
              <View key={h.id} style={styles.row} testID={`investment.holding.${h.id}`}>
                <View style={styles.rowAccent} />
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{h.name}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    {s.holdings.row(termLabel(h.termDays), shortDate(h.maturesOn))}
                  </AppText>
                </View>
                <View style={styles.rowRight}>
                  <AmountText amountMinor={h.amountMinor} size={15} />
                  <AppText variant="captionStrong" color="link">
                    {formatRate(h.rateEaBps)}
                  </AppText>
                  {h.isSimulated ? (
                    <Badge label={s.explore.simulated} tone="info" size="sm" />
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <ExploreSection />
        </View>

        <View style={[styles.section, styles.disclaimer]} testID="investment.disclaimer">
          <Icon name="shield" size={18} color={colors.primaryDark} />
          <AppText variant="small" color="textBody" style={styles.flex}>
            {s.disclaimer}
          </AppText>
        </View>
      </Screen>
    );
  };
}

function Tile({
  label,
  children,
  testID,
}: {
  label: string;
  children: React.ReactNode;
  testID: string;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tile} testID={testID}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      {children}
    </View>
  );
}

function createStyles({ colors, shadow }: Theme) {
  return StyleSheet.create({
    hero: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xl },
    heroLabel: { opacity: 0.92 },
    periods: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      borderRadius: radius.pill,
      backgroundColor: colors.onPrimaryFaint,
    },
    period: {
      height: 32,
      minWidth: 56,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    periodOn: { backgroundColor: colors.background },
    periodText: { fontFamily: fonts.body.bold, fontSize: 12, lineHeight: 16 },
    tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: 16 },
    tile: {
      flexGrow: 1,
      flexBasis: '45%',
      gap: 4,
      padding: 16,
      borderRadius: radius.card,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      ...shadow.card,
    },
    tileValue: { fontFamily: fonts.amount.semibold, fontSize: 17, lineHeight: 22 },
    section: { gap: spacing.md, paddingHorizontal: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowAccent: {
      width: 4,
      alignSelf: 'stretch',
      borderRadius: radius.pill,
      backgroundColor: colors.primaryLight,
    },
    rowRight: { alignItems: 'flex-end', gap: 2 },
    disclaimer: {
      flexDirection: 'row',
      marginHorizontal: 16,
      padding: 14,
      borderRadius: radius.card,
      backgroundColor: colors.surfaceBlueSoft,
      borderWidth: 1,
      borderColor: colors.borderBlue,
    },
    flex: { flex: 1, gap: 2 },
  });
}
