// Explorar (the same list for everyone, filters and order chosen by the person), the calculator
// and the Banco de la República reference. Filters and order live only in this component's
// state; no code path here reads a balance or a profile.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatCop, parseCopInput } from '@shared/domain';
import {
  AppText,
  Badge,
  Chip,
  SectionHeader,
  SegmentedControl,
  TextField,
  fonts,
  radius,
  spacing,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { useCdtCatalog, useCdtReference, useQuotes } from '../application/hooks';
import {
  DEFAULT_SORT,
  TERM_FILTERS,
  estimatedInterestMinor,
  exploreCatalog,
  formatChangeBps,
  formatRate,
  formatUsdCents,
  parseDaysInput,
  parseRateInput,
  shortDate,
  termLabel,
  type CdtProduct,
  type ExploreFilters,
  type ExploreSort,
  type Risk,
} from '../domain/investment';
import { investmentStrings as s } from './strings.es-CO';

const RISK_LEVEL: Record<Risk, number> = { low: 1, moderate: 2, high: 3 };

function RiskBars({ risk }: { risk: Risk }) {
  const styles = useThemedStyles(createStyles);
  const level = RISK_LEVEL[risk];
  return (
    <View style={styles.risk} accessibilityLabel={`${s.explore.risk}: ${s.explore.risks[risk]}`}>
      <View style={styles.bars}>
        {[8, 16, 24].map((h, i) => (
          <View
            key={h}
            style={[styles.bar, { height: h }, i < level ? styles.barOn : styles.barOff]}
          />
        ))}
      </View>
      <AppText style={styles.riskText} color="textSecondary">
        {s.explore.risks[risk]}
      </AppText>
    </View>
  );
}

export function ExploreSection() {
  const styles = useThemedStyles(createStyles);
  const [segment, setSegment] = useState<'cdt' | 'stocks'>('cdt');
  const [filters, setFilters] = useState<ExploreFilters>({ termDays: null, risk: null });
  const [sort, setSort] = useState<ExploreSort>(DEFAULT_SORT);
  const [amount, setAmount] = useState('');
  const [daysText, setDaysText] = useState('');
  const [rateText, setRateText] = useState('');
  const catalog = useCdtCatalog();
  const quotes = useQuotes(segment === 'stocks');
  const reference = useCdtReference();

  const pick = (p: CdtProduct) => {
    setDaysText(String(p.termDays));
    setRateText(formatRate(p.rateEaBps).replace(' % E.A.', ''));
  };

  const list = exploreCatalog(catalog.data ?? [], filters, sort);
  const amountMinor = parseCopInput(amount);
  const days = parseDaysInput(daysText);
  const rate = parseRateInput(rateText);
  const valid = amountMinor !== null && amountMinor > 0 && days !== null && rate !== null;
  const interest = valid ? estimatedInterestMinor(amountMinor, rate, days) : 0;

  return (
    <View style={styles.block}>
      <SectionHeader title={s.explore.title} />
      <SegmentedControl
        options={[
          { value: 'cdt', label: s.explore.segment.cdt },
          { value: 'stocks', label: s.explore.segment.stocks },
        ]}
        value={segment}
        onChange={setSegment}
        accessibilityLabel={s.explore.segmentLabel}
        testID="investment.explore.segment"
      />

      {segment === 'cdt' ? (
        <>
          <View style={styles.filterRow}>
            <AppText variant="captionStrong" color="textSecondary">
              {s.explore.term}
            </AppText>
            <View style={styles.chips}>
              <Chip
                label={s.explore.all}
                selected={filters.termDays === null}
                onPress={() => setFilters((f) => ({ ...f, termDays: null }))}
                testID="investment.term.all"
              />
              {TERM_FILTERS.map((d) => (
                <Chip
                  key={d}
                  label={s.explore.days(d)}
                  selected={filters.termDays === d}
                  onPress={() => setFilters((f) => ({ ...f, termDays: d }))}
                  testID={`investment.term.${d}`}
                />
              ))}
            </View>
          </View>
          <View style={styles.filterRow}>
            <AppText variant="captionStrong" color="textSecondary">
              {s.explore.risk}
            </AppText>
            <View style={styles.chips}>
              <Chip
                label={s.explore.all}
                selected={filters.risk === null}
                onPress={() => setFilters((f) => ({ ...f, risk: null }))}
                testID="investment.risk.all"
              />
              {(['low', 'moderate', 'high'] as const).map((r) => (
                <Chip
                  key={r}
                  label={s.explore.risks[r]}
                  selected={filters.risk === r}
                  onPress={() => setFilters((f) => ({ ...f, risk: r }))}
                  testID={`investment.risk.${r}`}
                />
              ))}
            </View>
          </View>
          <View style={styles.filterRow}>
            <AppText variant="captionStrong" color="textSecondary">
              {s.explore.sort}
            </AppText>
            <View style={styles.chips}>
              {(['name', 'rate', 'term'] as const).map((k) => (
                <Chip
                  key={k}
                  label={s.explore.sorts[k]}
                  selected={sort === k}
                  onPress={() => setSort(k)}
                  testID={`investment.sort.${k}`}
                />
              ))}
            </View>
          </View>

          {catalog.isError ? (
            <AppText variant="small" color="textSecondary">
              {s.explore.unavailable}
            </AppText>
          ) : list.length === 0 && catalog.data ? (
            <AppText variant="small" color="textSecondary">
              {s.explore.empty}
            </AppText>
          ) : (
            <View style={styles.cards} testID="investment.catalog">
              {list.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => pick(p)}
                  accessibilityRole="button"
                  accessibilityHint={s.explore.useInCalculator}
                  testID={`investment.product.${p.id}`}
                  style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
                >
                  <RiskBars risk={p.risk} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{p.name}</AppText>
                    <AppText variant="caption" color="textSecondary">
                      {s.explore.productRow(termLabel(p.termDays), formatRate(p.rateEaBps))}
                    </AppText>
                  </View>
                  {p.simulated ? <Badge label={s.explore.simulated} tone="info" /> : null}
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.cards} testID="investment.stocks">
          <AppText variant="caption" color="textSecondary">
            {s.explore.stocksNote}
          </AppText>
          {quotes.isError ? (
            <AppText variant="small" color="textSecondary">
              {s.explore.stocksUnavailable}
            </AppText>
          ) : (
            (quotes.data ?? []).map((q) => (
              <View key={q.symbol} style={styles.card} testID={`investment.stock.${q.symbol}`}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{q.symbol}</AppText>
                  <AppText variant="caption" color="textSecondary">
                    {q.name}
                  </AppText>
                </View>
                <View style={styles.right}>
                  <AppText variant="label">{formatUsdCents(q.lastPriceCents)}</AppText>
                  <AppText variant="captionStrong" color={q.dayChangeBps >= 0 ? 'link' : 'danger'}>
                    {formatChangeBps(q.dayChangeBps)}
                  </AppText>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <View style={styles.calculator} testID="investment.calculator">
        <AppText variant="cardTitle">{s.calculator.title}</AppText>
        <TextField
          label={s.calculator.amount}
          helper={s.calculator.amountHelper}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          testID="investment.calculator.amount"
        />
        <TextField
          label={s.calculator.days}
          value={daysText}
          onChangeText={setDaysText}
          keyboardType="number-pad"
          testID="investment.calculator.days"
        />
        <TextField
          label={s.calculator.rate}
          helper={s.calculator.rateHelper}
          value={rateText}
          onChangeText={setRateText}
          keyboardType="decimal-pad"
          testID="investment.calculator.rate"
        />
        <AppText variant="bodyStrong" testID="investment.calculator.result">
          {valid ? s.calculator.result(formatCop(interest)) : s.calculator.invalid}
        </AppText>
        {valid && amountMinor !== null ? (
          <AppText variant="small" color="textSecondary">
            {s.calculator.total(formatCop(amountMinor + interest))}
          </AppText>
        ) : null}
      </View>

      {reference.data ? (
        <View style={styles.reference} testID="investment.reference">
          <AppText variant="small" color="textBody">
            {s.reference(
              formatRate(reference.data.rateEaBps),
              shortDate(reference.data.week, true),
            )}
          </AppText>
          {reference.data.stale ? (
            <AppText variant="caption" color="textSecondary">
              {s.referenceStale}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function createStyles({ colors, shadow }: Theme) {
  return StyleSheet.create({
    block: { gap: spacing.xl },
    filterRow: { gap: spacing.sm },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    cards: { gap: spacing.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      padding: 16,
      borderRadius: radius.card,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.borderBlue,
      ...shadow.card,
    },
    risk: { width: 56, alignItems: 'center', gap: 4 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 24 },
    bar: { width: 8, borderRadius: 3 },
    barOn: { backgroundColor: colors.accent },
    barOff: { backgroundColor: colors.focusRing },
    riskText: { fontFamily: fonts.body.bold, fontSize: 10, lineHeight: 13, textAlign: 'center' },
    right: { alignItems: 'flex-end', gap: 2 },
    calculator: {
      gap: spacing.lg,
      padding: 16,
      borderRadius: radius.cardLg,
      backgroundColor: colors.surfaceBlueSoft,
      borderWidth: 1,
      borderColor: colors.borderBlue,
    },
    reference: {
      gap: spacing.xs,
      padding: 14,
      borderRadius: radius.card,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.accentSoft,
    },
    flex: { flex: 1, gap: 2 },
    pressed: { opacity: 0.85 },
  });
}
