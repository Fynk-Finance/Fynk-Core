// Blue summary card of Estadísticas (Estadisticas.html, .st-card): back button and title, "Gastaste
// en los últimos 30 días" with Ingresos, the legend and the balance, the cumulative spending of
// this period (solid) against the previous one (dotted) with today's dot and label, five dates and
// the period control. It shrinks while the page scrolls: `progress` goes from 0 to 1 over 282 px.
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { formatCop } from '@shared/domain';
import {
  AmountText,
  AppText,
  BackButton,
  Icon,
  SegmentedControl,
  Shine,
  spacing,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { PeriodSummary, StatsPeriod } from '../../domain/statistics';
import { analyticsStrings } from '../strings.es-CO';
import { axisLabels, changePercent, curveGeometry } from './geometry';

const t = analyticsStrings.statistics;

/** Sizes of the design: 563 px open, 282 px less when scrolled, the summary block 92 px. */
export const CARD_HEIGHT = 563;
export const CARD_SHRINK = 282;
const SUMMARY_HEIGHT = 92;

const PERIODS: StatsPeriod[] = ['3d', 'week', 'month', 'year'];

export interface SummaryCardProps {
  summary: PeriodSummary | null;
  period: StatsPeriod;
  onPeriod: (period: StatsPeriod) => void;
  onBack: () => void;
  progress: SharedValue<number>;
}

export function SummaryCard({ summary, period, onPeriod, onBack, progress }: SummaryCardProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const cardStyle = useAnimatedStyle(() => ({
    height: insets.top + CARD_HEIGHT - CARD_SHRINK * progress.value,
  }));
  const summaryStyle = useAnimatedStyle(() => ({
    height: SUMMARY_HEIGHT * (1 - progress.value),
    opacity: interpolate(progress.value, [0, 1 / 1.7], [1, 0], 'clamp'),
  }));

  const balance = summary?.balanceMinor ?? 0;
  const signedBalance = `${balance >= 0 ? '+' : '−'}${formatCop(Math.abs(balance))}`;

  return (
    <Animated.View
      style={[styles.card, { paddingTop: insets.top + spacing.xl }, cardStyle]}
      testID="analytics.statistics.card"
    >
      <Svg width={390} height={CARD_HEIGHT + insets.top} style={StyleSheet.absoluteFill}>
        <Rect x={258} y={-96} width={220} height={220} rx={52} fill={colors.headerShapeA} />
        <Rect x={318} y={-36} width={106} height={106} rx={26} fill={colors.headerShapeB} />
        <Rect
          x={-80}
          y={420 + insets.top}
          width={170}
          height={170}
          rx={40}
          fill={colors.primaryPressed}
        />
      </Svg>
      <Shine distance={640} height={CARD_HEIGHT + insets.top} width={56} opacity={0.08} />

      <View style={styles.header}>
        <BackButton onPress={onBack} accessibilityLabel={t.back} />
        <AppText variant="headerTitle" color="onPrimary" accessibilityRole="header">
          {t.title}
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      <Animated.View style={[styles.summary, summaryStyle]}>
        <AppText variant="smallStrong" color="onPrimary" style={styles.dim}>
          {t.spentIn[period]}
        </AppText>
        <View style={styles.amountRow}>
          <AmountText
            amountMinor={summary?.spendingMinor ?? 0}
            size={30}
            color="onPrimary"
            testID="analytics.statistics.spent"
          />
          <View
            style={styles.incomePill}
            accessible
            accessibilityLabel={t.incomeLabel(formatCop(summary?.incomeMinor ?? 0))}
          >
            <View style={styles.incomeIcon}>
              <Icon name="arrowDownLeft" size={16} strokeWidth={3} color={colors.onPrimary} />
            </View>
            <View>
              <AppText variant="overline" color="onPrimary" style={styles.incomeLabel}>
                {t.income}
              </AppText>
              <AmountText
                amountMinor={summary?.incomeMinor ?? 0}
                size={13}
                color="onPrimary"
                testID="analytics.statistics.income"
              />
            </View>
          </View>
        </View>
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.legendSolid} />
            <AppText variant="captionStrong" color="onPrimary" style={styles.legendText}>
              {t.thisPeriod}
            </AppText>
          </View>
          <View style={styles.legendItem}>
            <Svg width={18} height={4}>
              <Path
                d="M2 2h1M8.5 2h1M15 2h1"
                stroke={colors.onPrimary}
                strokeOpacity={0.6}
                strokeWidth={3}
                strokeLinecap="round"
              />
            </Svg>
            <AppText variant="captionStrong" color="onPrimary" style={styles.legendText}>
              {t.previousPeriod}
            </AppText>
          </View>
          <AppText
            variant="captionStrong"
            color="onPrimary"
            style={styles.balance}
            testID="analytics.statistics.balance"
          >
            {t.balance(signedBalance)}
          </AppText>
        </View>
      </Animated.View>

      <Curve summary={summary} period={period} />

      <View style={styles.axis} accessibilityElementsHidden importantForAccessibility="no">
        {axisLabels(summary?.current ?? [], t.months, t.today).map((label, i) => (
          <AppText key={i} variant="captionStrong" color="onPrimary" style={styles.axisLabel}>
            {label}
          </AppText>
        ))}
      </View>

      <View style={styles.periods}>
        <SegmentedControl
          options={PERIODS.map((value) => ({ value, label: t.periods[value] }))}
          value={period}
          onChange={onPeriod}
          accessibilityLabel={t.periodGroup}
          testID="analytics.statistics.period"
        />
      </View>
    </Animated.View>
  );
}

function Curve({ summary, period }: { summary: PeriodSummary | null; period: StatsPeriod }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const onLayout = (e: LayoutChangeEvent) =>
    setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });

  const g = curveGeometry(summary?.current ?? [], summary?.previous ?? []);
  const change = t.changeVs(
    changePercent(summary?.spendingMinor ?? 0, summary?.previousSpendingMinor ?? 0),
    t.previousOf[period],
  );
  const label = t.chartLabel(
    t.lastDays[period].toLowerCase(),
    formatCop(summary?.spendingMinor ?? 0),
    formatCop(summary?.incomeMinor ?? 0),
    change,
  );

  return (
    <View
      style={styles.chart}
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      testID="analytics.statistics.chart"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <LinearGradient id="st-fill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.onPrimary} stopOpacity={0.32} />
            <Stop offset="1" stopColor={colors.onPrimary} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {[20, 50, 80].map((y) => (
          <Line
            key={y}
            x1={0}
            x2={100}
            y1={y}
            y2={y}
            stroke={colors.onPrimary}
            strokeOpacity={0.18}
            strokeWidth={1.5}
            strokeDasharray="2 7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {g.area ? <Path d={g.area} fill="url(#st-fill)" /> : null}
        <Path
          d={g.previous}
          fill="none"
          stroke={colors.onPrimary}
          strokeOpacity={0.5}
          strokeWidth={3}
          strokeDasharray="0.1 9"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <Path
          d={g.current}
          fill="none"
          stroke={colors.onPrimary}
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </Svg>
      {box.width > 0 ? (
        <>
          <View
            style={[
              styles.dot,
              { left: (box.width * g.end.x) / 100 - 8, top: (box.height * g.end.y) / 100 - 8 },
            ]}
          />
          <View style={[styles.today, { top: (box.height * g.end.y) / 100 - 22 }]}>
            <AppText variant="overline" color="textSecondary" style={styles.todayLabel}>
              {t.today}
            </AppText>
            <AmountText
              amountMinor={summary?.todayMinor ?? 0}
              size={13}
              testID="analytics.statistics.today"
            />
          </View>
        </>
      ) : null}
    </View>
  );
}

// Sizes from Estadisticas.html: 30 px bottom corners, 16 px header padding, summary 24 px in,
// chart 24 px from the summary with 32 px right margin, dates 8 px below, the control 16 px.
const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    card: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      zIndex: 2,
      backgroundColor: colors.primary,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
      overflow: 'hidden',
      paddingBottom: 16,
      ...shadow.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    headerSpacer: { width: 48 },
    summary: { paddingHorizontal: 24, overflow: 'hidden' },
    dim: { paddingTop: 16, opacity: 0.9 },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 },
    incomePill: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 14,
      backgroundColor: colors.onPrimaryOverlay,
    },
    incomeIcon: {
      width: 24,
      height: 24,
      borderRadius: 9,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    incomeLabel: { fontSize: 10, lineHeight: 12, letterSpacing: 0, textTransform: 'none' },
    legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    legendSolid: { width: 16, height: 4, borderRadius: 999, backgroundColor: colors.onPrimary },
    legendText: { fontSize: 11, lineHeight: 14, opacity: 0.85 },
    balance: { marginLeft: 'auto', fontSize: 11, lineHeight: 14 },
    chart: {
      flexGrow: 1,
      flexShrink: 1,
      minHeight: 80,
      marginTop: 24,
      marginLeft: 24,
      marginRight: 32,
    },
    dot: {
      position: 'absolute',
      width: 16,
      height: 16,
      borderRadius: 999,
      backgroundColor: colors.onPrimary,
      borderWidth: 4,
      borderColor: colors.accent,
    },
    today: {
      position: 'absolute',
      right: 16,
      alignItems: 'flex-end',
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 12,
      backgroundColor: colors.background,
      ...shadow.card,
    },
    todayLabel: { fontSize: 10, lineHeight: 13, letterSpacing: 0, textTransform: 'none' },
    axis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
      marginHorizontal: 24,
    },
    axisLabel: { fontSize: 11, lineHeight: 14, opacity: 0.8 },
    periods: { marginTop: 16, marginHorizontal: 16 },
  });
