// "Balance total" card of the Dashboard (design Dashboard and DashboardDetalles): the total,
// "COP · N cuentas conectadas" and the Ingresos and Gastos boxes. "Balance total" opens
// "Cómo se calcula" (M6 rules; not in the design, needs design review).
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { MoneyMinor } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Icon,
  Shine,
  Skeleton,
  fonts,
  fontSize,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
  type IconName,
  type Theme,
} from '@shared/ui';

import type { MonthSummary } from '../domain/dashboard';
import { accountsStrings } from './strings.es-CO';

const t = accountsStrings.dashboard;
const HEIGHT = 206;

export interface DashboardBalanceCardProps {
  /** Null while the accounts load. */
  totalMinor: MoneyMinor | null;
  connectedCount: number;
  summary: MonthSummary;
}

export function DashboardBalanceCard({
  totalMinor,
  connectedCount,
  summary,
}: DashboardBalanceCardProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [width, setWidth] = useState(350);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const explain = () => Alert.alert(t.howTitle, t.howMessage, [{ text: t.ok }]);

  return (
    <View style={styles.card} onLayout={onLayout} testID="accounts.balanceCard">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={width} height={HEIGHT}>
          <Rect
            x={width - 142}
            y={-78}
            width={190}
            height={190}
            rx={40}
            fill={colors.cardShapeLight}
          />
          <Rect
            x={width - 82}
            y={-30}
            width={110}
            height={110}
            rx={26}
            fill={colors.cardShapeLighter}
          />
          <Rect x={-46} y={150} width={120} height={120} rx={28} fill={colors.headerShapeB} />
        </Svg>
        <Shine distance={width + 170} height={300} />
      </View>
      <View style={styles.top}>
        <Pressable
          onPress={explain}
          accessibilityRole="button"
          accessibilityLabel={`${t.balanceTotal}. ${t.howTitle}`}
          style={styles.label}
          hitSlop={8}
        >
          <AppText variant="small" color="onPrimary" style={styles.labelText}>
            {t.balanceTotal}
          </AppText>
          <Icon name="help" size={14} color={colors.onPrimary} />
        </Pressable>
        {totalMinor === null ? (
          <Skeleton width={200} height={40} />
        ) : (
          <AmountText
            amountMinor={totalMinor}
            size={34}
            color="onPrimary"
            testID="accounts.total"
          />
        )}
        <AppText variant="caption" color="onPrimary" style={styles.connected}>
          {t.connected(connectedCount)}
        </AppText>
      </View>
      <View style={styles.pills}>
        <Pill label={t.income} amountMinor={summary.incomeMinor} icon="arrowUpRight" tone="link" />
        <Pill
          label={t.spending}
          amountMinor={summary.spendingMinor}
          icon="arrowDownLeft"
          tone="primaryDark"
        />
      </View>
    </View>
  );
}

function Pill(props: {
  label: string;
  amountMinor: MoneyMinor;
  icon: IconName;
  tone: 'link' | 'primaryDark';
}) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.pill} accessible accessibilityLabel={props.label}>
      <View style={styles.tile}>
        <Icon name={props.icon} size={16} strokeWidth={2.4} color={colors[props.tone]} />
      </View>
      <View>
        <AppText variant="caption" color="onPrimary" style={styles.pillLabel}>
          {props.label}
        </AppText>
        <AmountText amountMinor={props.amountMinor} size={13} color="onPrimary" />
      </View>
    </View>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    card: {
      height: HEIGHT,
      borderRadius: radius.sheetSm,
      backgroundColor: colors.balanceCard,
      paddingTop: 24,
      paddingHorizontal: 24,
      paddingBottom: 16,
      justifyContent: 'space-between',
      overflow: 'hidden',
      ...shadow.balanceCard,
    },
    top: { gap: spacing.md },
    label: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
    labelText: { fontFamily: fonts.body.medium, opacity: 0.92 },
    connected: { opacity: 0.9 },
    pills: { flexDirection: 'row', gap: spacing.md },
    pill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.input,
      backgroundColor: colors.balanceCardPill,
    },
    tile: {
      width: 32,
      height: 32,
      borderRadius: radius.tileSm,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillLabel: { fontSize: fontSize[11], lineHeight: 14, opacity: 0.92 },
  });
