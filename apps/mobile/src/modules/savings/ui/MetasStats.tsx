// Stats card of Metas (design Metas, `#mt-stats`): a 74 px ring with "23 %", "de tus ingresos va
// a tus metas · $1.309.000 al mes de $5.580.000", then "Ahorrado", "Abonado este mes" (green,
// with a plus) and "Cumplidas". The income comes from M10; until it is available the ring is
// left out and the card says "$1.309.000 al mes van a tus metas" (new copy, needs review).
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatCop } from '@shared/domain/money';
import type { MoneyMinor } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Donut,
  fonts,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { GoalsOverview } from '../application/goalService';
import { shareOfIncome } from '../domain/goals';
import { savingsStrings } from './strings.es-CO';

const t = savingsStrings.metas;

export function MetasStats({
  overview,
  incomeMinor,
}: {
  overview: GoalsOverview;
  incomeMinor: MoneyMinor | null;
}) {
  const styles = useThemedStyles(createStyles);
  const share = incomeMinor === null ? null : shareOfIncome(overview.monthlyMinor, incomeMinor);
  return (
    <View style={styles.card} testID="savings.metas.stats">
      <View style={styles.top}>
        {share !== null ? (
          <Donut
            size={74}
            radius={30}
            strokeWidth={10}
            gap={0}
            segments={ringSegments(share)}
            accessibilityLabel={`${share} % ${t.shareOfIncome}`}
          >
            <AppText variant="headerTitle" style={styles.ring}>{`${share} %`}</AppText>
          </Donut>
        ) : null}
        <View style={styles.headline}>
          {share !== null && incomeMinor !== null ? (
            <>
              <AppText variant="bodyStrong">{t.shareOfIncome}</AppText>
              <AppText variant="caption" color="textSecondary">
                {`${formatCop(overview.monthlyMinor)} ${t.shareDetail} ${formatCop(incomeMinor)}`}
              </AppText>
            </>
          ) : (
            <AppText variant="bodyStrong">
              {`${formatCop(overview.monthlyMinor)} ${t.monthlyAlone}`}
            </AppText>
          )}
        </View>
      </View>
      <View style={styles.grid}>
        <Stat label={t.saved}>
          <AmountText amountMinor={overview.savedMinor} size={14} />
        </Stat>
        <Stat label={t.contributedThisMonth}>
          <AmountText
            amountMinor={overview.contributedThisMonthMinor}
            size={14}
            signed
            color="accentText"
            testID="savings.metas.stats.month"
          />
        </Stat>
        <Stat label={t.done}>
          <AppText variant="smallStrong" style={styles.mono}>
            {String(overview.doneCount)}
          </AppText>
        </Stat>
      </View>
    </View>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.stat}>
      <AppText variant="caption" color="textSecondary" style={styles.small}>
        {label}
      </AppText>
      {children}
    </View>
  );
}

/** The lime arc of the share over the light blue track, starting at 12 o'clock. */
function ringSegments(share: number) {
  const value = Math.min(100, share);
  return [
    { value, color: 'accent' as const },
    { value: 100 - value, color: 'surfaceBlue' as const },
  ];
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    // Overlaps the bottom 48 px of the blue header, as in the design.
    card: {
      marginTop: -48,
      marginHorizontal: 16,
      padding: 16,
      gap: 16,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      backgroundColor: colors.background,
      ...shadow.header,
    },
    top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    ring: { fontSize: 18 },
    headline: { flexShrink: 1, gap: 4 },
    grid: {
      flexDirection: 'row',
      gap: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    stat: { flex: 1, minWidth: 0, gap: 2 },
    small: { fontSize: 11, lineHeight: 14 },
    mono: { fontFamily: fonts.amount.semibold, fontSize: 14, lineHeight: 19 },
  });
