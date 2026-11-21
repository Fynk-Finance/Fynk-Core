// Sections of Estadísticas under the summary card (Estadisticas.html): "Gastos por categoría"
// (donut, legend and the rows with icon and bar, a tap opens M7's list), "Tus estadísticas" (four
// tiles), "Por día de la semana" (bars, the highest in lime) and "Dónde más gastas".
import { Pressable, StyleSheet, View } from 'react-native';

import { categoryLabel, formatCop, type CategoryId } from '@shared/domain';
import {
  AmountText,
  AppText,
  Donut,
  Icon,
  spacing,
  useTheme,
  useThemedStyles,
  type ColorToken,
  type IconName,
  type Theme,
} from '@shared/ui';

import type { PeriodStats, TopPlace, WeekdayPattern } from '../../domain/statistics';
import type { SpendByCategory } from '../../domain/types';
import { segmentColor } from '../chartColors';
import { analyticsStrings } from '../strings.es-CO';
import { shortCop, shortDate } from './geometry';

const t = analyticsStrings.statistics;

/** Icons of the category rows, from the shared set (Hogar house, Comida cutlery, …). */
const CATEGORY_ICONS: Partial<Record<CategoryId, IconName>> = {
  rent: 'home',
  utilities: 'bolt',
  telecom: 'phone',
  groceries: 'cart',
  restaurants: 'food',
  cinema: 'play',
  treats: 'coffee',
  transport: 'bus',
  subscriptions: 'tv',
  gym: 'gym',
  savings: 'piggy',
};

export function CategoriesCard({
  data,
  periodLabel,
  onOpen,
}: {
  data: SpendByCategory;
  periodLabel: string;
  onOpen: (categoryId: CategoryId) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const top = data.categories[0]?.amountMinor ?? 1;
  const legend = data.categories.map((c) => `${categoryLabel(c.categoryId)} ${c.sharePercent} %`);
  return (
    <View style={styles.card} testID="analytics.statistics.categories">
      <View style={styles.titleRow}>
        <AppText variant="section" style={styles.h2} accessibilityRole="header">
          {t.byCategory}
        </AppText>
        <AppText variant="captionStrong" color="textSecondary">
          {periodLabel}
        </AppText>
      </View>
      <View style={styles.donutRow}>
        <Donut
          size={150}
          radius={56}
          strokeWidth={22}
          gap={0}
          segments={data.categories.map((c, i) => ({
            value: c.amountMinor,
            color: segmentColor(i),
          }))}
          accessibilityLabel={`${t.byCategory}: ${legend.join(', ')}`}
        >
          <AppText variant="caption" color="textSecondary" style={styles.totalLabel}>
            {analyticsStrings.spending.total}
          </AppText>
          <AmountText amountMinor={data.totalMinor} size={13} testID="analytics.total" />
        </Donut>
        <View style={styles.legend}>
          {data.categories.slice(0, 6).map((c, i) => (
            <View key={c.categoryId} style={styles.legendRow}>
              <View style={[styles.swatch, { backgroundColor: colors[segmentColor(i)] }]} />
              <AppText variant="caption" color="textBody" numberOfLines={1} style={styles.flex}>
                {categoryLabel(c.categoryId)}
              </AppText>
              <AppText variant="captionStrong">{`${c.sharePercent} %`}</AppText>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.rows}>
        {data.categories.map((c, i) => (
          <Pressable
            key={c.categoryId}
            onPress={() => onOpen(c.categoryId)}
            accessibilityRole="button"
            accessibilityLabel={`${categoryLabel(c.categoryId)}, ${formatCop(c.amountMinor)}, ${c.sharePercent} %`}
            testID={`analytics.category.${c.categoryId}`}
            style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
          >
            <View style={styles.rowIcon}>
              <Icon
                name={CATEGORY_ICONS[c.categoryId] ?? 'chartLine'}
                size={16}
                color={colors[segmentColor(i)]}
              />
            </View>
            <View style={styles.rowBody}>
              <View style={styles.rowTop}>
                <AppText variant="label">{categoryLabel(c.categoryId)}</AppText>
                <AmountText amountMinor={c.amountMinor} size={14} />
              </View>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${Math.max(2, (c.amountMinor * 100) / top)}%`,
                      backgroundColor: colors[segmentColor(i)],
                    },
                  ]}
                />
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Tile({
  icon,
  iconColor,
  tone,
  title,
  value,
  valueColor,
  detail,
  testID,
}: {
  icon: IconName;
  iconColor: ColorToken;
  tone: ColorToken;
  title: string;
  value: string;
  valueColor?: ColorToken;
  detail: string;
  testID: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: colors[tone] }]} testID={testID}>
      <View style={styles.tileTitle}>
        <Icon name={icon} size={16} strokeWidth={2.2} color={colors[iconColor]} />
        <AppText variant="captionStrong" color="textSecondary">
          {title}
        </AppText>
      </View>
      <AppText
        variant="cardTitle"
        style={[styles.tileValue, { color: colors[valueColor ?? 'textPrimary'] }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </AppText>
      <AppText variant="caption" color="textSecondary" style={styles.tileDetail} numberOfLines={2}>
        {detail}
      </AppText>
    </View>
  );
}

export function StatTiles({
  stats,
  periodLabel,
  previousLabel,
}: {
  stats: PeriodStats;
  periodLabel: string;
  previousLabel: string;
}) {
  const styles = useThemedStyles(createStyles);
  const saved = stats.savedVsPreviousMinor;
  return (
    <View style={styles.section} testID="analytics.statistics.stats">
      <AppText variant="section" style={styles.h2} accessibilityRole="header">
        {t.yourStats}
      </AppText>
      <View style={styles.grid}>
        <Tile
          icon="calendar"
          iconColor="primaryDark"
          tone="surfaceBlueSoft"
          title={t.dailyAverage}
          value={formatCop(stats.dailyAverageMinor)}
          detail={periodLabel}
          testID="analytics.statistics.dailyAverage"
        />
        <Tile
          icon="arrowUpRight"
          iconColor="danger"
          tone="dangerSurface"
          title={t.highest}
          value={formatCop(stats.highest?.amountMinor ?? 0)}
          detail={
            stats.highest
              ? t.highestDetail(stats.highest.label, shortDate(stats.highest.date, t.months))
              : '—'
          }
          testID="analytics.statistics.highest"
        />
        <Tile
          icon="filter"
          iconColor="primaryDark"
          tone="surfaceBlueSoft"
          title={t.movements}
          value={String(stats.movementCount)}
          detail={t.movementsDelta(stats.movementDelta, previousLabel)}
          testID="analytics.statistics.movements"
        />
        <Tile
          icon="check"
          iconColor="accentText"
          tone="accentSurface"
          title={saved >= 0 ? t.saved : t.spentMore}
          value={formatCop(Math.abs(saved))}
          valueColor={saved >= 0 ? 'accentText' : 'danger'}
          detail={t.versus(previousLabel)}
          testID="analytics.statistics.saved"
        />
      </View>
    </View>
  );
}

export function WeekdayCard({ pattern }: { pattern: WeekdayPattern }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const max = Math.max(...pattern.averagesMinor, 1);
  const peak = pattern.peak;
  const bars = pattern.averagesMinor
    .map((avg, i) => `${t.weekdaysShort[i]} ${formatCop(avg)}`)
    .join(', ');
  const sentence =
    peak && peak.timesPercent > 110
      ? t.weekdayPeak(
          t.weekdaysPlural[peak.weekday]!,
          t.times(peak.timesPercent),
          peak.againstWeekdays,
        )
      : null;
  return (
    <View style={styles.card} testID="analytics.statistics.weekdays">
      <View style={styles.titleRow}>
        <AppText variant="headerTitle" accessibilityRole="header">
          {t.byWeekday}
        </AppText>
        <AppText variant="captionStrong" color="textSecondary">
          {t.average}
        </AppText>
      </View>
      <View
        style={styles.bars}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t.weekdayChart(bars)}
      >
        {pattern.averagesMinor.map((avg, i) => {
          const top = peak?.weekday === i;
          return (
            <View key={i} style={styles.barColumn}>
              <AppText
                variant="overline"
                color={top ? 'accentText' : 'textPlaceholder'}
                style={styles.barValue}
              >
                {shortCop(avg)}
              </AppText>
              <View
                style={[
                  styles.weekBar,
                  {
                    height: Math.max(4, (86 * avg) / max),
                    backgroundColor: top ? colors.accent : colors.borderBlueStrong,
                  },
                ]}
              />
              <AppText variant="captionStrong" color="textSecondary">
                {t.weekdaysShort[i]}
              </AppText>
            </View>
          );
        })}
      </View>
      <AppText variant="small" color="textSecondary" testID="analytics.statistics.weekdayPeak">
        {sentence ? (
          <>
            {sentence[0]}
            <AppText variant="smallStrong">{sentence[1]}</AppText>
            {sentence[2]}
          </>
        ) : (
          t.weekdayEven
        )}
      </AppText>
    </View>
  );
}

export function TopPlaces({ places }: { places: TopPlace[] }) {
  const styles = useThemedStyles(createStyles);
  if (places.length === 0) return null;
  return (
    <View style={styles.section} testID="analytics.statistics.places">
      <AppText variant="section" style={styles.h2} accessibilityRole="header">
        {t.topPlaces}
      </AppText>
      {places.map((p, i) => (
        <View key={p.key} style={styles.place} testID={`analytics.statistics.place.${i + 1}`}>
          <View style={styles.rank}>
            <AppText variant="label" color="primaryDark" style={styles.rankText}>
              {String(i + 1)}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText variant="label" numberOfLines={1}>
              {p.label}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {`${t.placeCount(p.count, p.categoryId)} · ${categoryLabel(p.categoryId)}`}
            </AppText>
          </View>
          <AmountText amountMinor={p.totalMinor} size={14} />
        </View>
      ))}
    </View>
  );
}

// Sizes from Estadisticas.html: cards 16 px padding, 22 px corners, 1 px blue border; tiles
// 18 px corners on a two column grid with 8 px gaps; bars up to 86 px, 10 px corners, 32 px wide.
const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    card: {
      gap: 16,
      padding: 16,
      borderRadius: 22,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      ...shadow.card,
    },
    section: { gap: spacing.md },
    h2: { fontSize: 19, lineHeight: 24 },
    titleRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
    donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    totalLabel: { fontSize: 11, lineHeight: 14 },
    legend: { flex: 1, minWidth: 0, gap: spacing.md },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    swatch: { width: 10, height: 10, borderRadius: 4 },
    rows: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: spacing.md },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xs,
      borderRadius: 12,
    },
    pressed: { backgroundColor: colors.surfaceBlueSoft },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: colors.surfaceBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: spacing.xs, minWidth: 0 },
    rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
    track: { height: 6, borderRadius: 999, backgroundColor: colors.divider, overflow: 'hidden' },
    bar: { height: '100%', borderRadius: 999 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    tile: { flexBasis: '48%', flexGrow: 1, gap: spacing.md, padding: 16, borderRadius: 18 },
    tileTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    tileValue: { fontSize: 19, lineHeight: 24 },
    tileDetail: { fontSize: 11, lineHeight: 15 },
    bars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: spacing.md,
      height: 132,
    },
    barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md },
    barValue: { fontSize: 10, lineHeight: 12, letterSpacing: 0, textTransform: 'none' },
    weekBar: { width: '100%', maxWidth: 32, borderRadius: 10 },
    place: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      ...shadow.card,
    },
    rank: {
      width: 32,
      height: 32,
      borderRadius: 11,
      backgroundColor: colors.surfaceBlue,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rankText: { fontSize: 14 },
    flex: { flex: 1, minWidth: 0 },
  });
