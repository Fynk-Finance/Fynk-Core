// Movimientos (design: Movimientos, inventory row 13). Pushed with the default transition, from
// "Ver todo" on the Dashboard. Title and back button, the sticky bar with the summary line, days
// with their net, rows newest first, "Cargar 20 más" (keyset pages of 20) and pull to refresh,
// which starts a sync (rule 4 of CLAUDE.md, M5 applies the 60 s cooldown).
import { useNavigation } from '@react-navigation/native';
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Account, Clock, Transaction } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  EmptyState,
  ErrorState,
  Icon,
  Skeleton,
  fonts,
  radius,
  size,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { TransactionHooks } from '../application/useTransactions';
import { groupByDay, type DayGroup } from '../domain/dayGroups';
import type { TransactionFilter } from '../domain/query';
import { dayHeader, entityNames, listSubtitle, summaryLine, titleOf } from './labels';
import { transactionsStrings as s } from './strings.es-CO';
import { TransactionRow } from './TransactionRow';

export const TRANSACTIONS_ROUTE = 'transactions.All';

export interface AllTransactionsDeps {
  hooks: Pick<TransactionHooks, 'useTransactionPages' | 'useTransactionSummary'>;
  /** The person's accounts, for the "Mercado · Bancolombia" subtitles (M6). */
  useAccounts: () => { data?: { accounts: Account[] } };
  /** Pull to refresh: M5's syncNow(). */
  refresh: () => Promise<unknown>;
  clock: Clock;
}

type Section = DayGroup & { data: Transaction[] };

const NO_FILTER: TransactionFilter = {};

export function createAllTransactionsScreen({
  hooks,
  useAccounts,
  refresh,
  clock,
}: AllTransactionsDeps) {
  return function AllTransactionsScreen() {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const filter = NO_FILTER;
    const pages = hooks.useTransactionPages(filter);
    const summary = hooks.useTransactionSummary(filter);
    const accounts = useAccounts().data?.accounts;
    const [refreshing, setRefreshing] = useState(false);

    const items = useMemo(() => pages.data?.pages.flatMap((p) => p.items) ?? [], [pages.data]);
    const entities = useMemo(() => entityNames(accounts ?? []), [accounts]);
    const sections = useMemo<Section[]>(
      () => groupByDay(items, clock.now()).map((g) => ({ ...g, data: g.items })),
      [items],
    );

    const onRefresh = async () => {
      setRefreshing(true);
      try {
        await refresh().catch(() => undefined);
        await Promise.all([pages.refetch(), summary.refetch()]);
      } finally {
        setRefreshing(false);
      }
    };

    const header = (
      <View style={[styles.header, { paddingTop: insets.top + 32 }]}>
        <AppText variant="title" accessibilityRole="header">
          {s.list.title}
        </AppText>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={s.list.back}
          hitSlop={4}
          style={({ pressed }) => [styles.back, pressed ? styles.backPressed : null]}
        >
          <Icon name="chevronLeft" size={24} strokeWidth={2.4} color={colors.primaryDark} />
        </Pressable>
      </View>
    );

    const bar = (
      <View style={styles.bar}>
        {summary.data ? (
          <AppText variant="caption" color="textSecondary" testID="transactions.summary">
            {summaryLine(items.length, summary.data)}
          </AppText>
        ) : null}
      </View>
    );

    let body: ReactNode = null;
    if (pages.isPending) {
      body = (
        <View style={styles.placeholder} testID="transactions.loading">
          <Skeleton width={90} height={12} />
          <Skeleton height={56} radius={14} />
          <Skeleton height={56} radius={14} />
          <Skeleton height={56} radius={14} />
        </View>
      );
    } else if (pages.isError) {
      body = (
        <View style={styles.placeholder}>
          <ErrorState message={s.list.error} onRetry={() => void pages.refetch()} />
        </View>
      );
    }

    return (
      <View style={styles.root} testID="transactions.all">
        {header}
        {bar}
        {body ?? (
          <SectionList<Transaction, Section>
            testID="transactions.list"
            sections={sections}
            keyExtractor={(tx) => tx.id}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.background}
              />
            }
            renderSectionHeader={({ section }) => (
              <View
                style={[styles.dayHeader, section !== sections[0] ? styles.dayGap : null]}
                testID={`transactions.day.${section.day}`}
              >
                <AppText variant="caption" color="textSecondary" style={styles.dayTitle}>
                  {dayHeader(section)}
                </AppText>
                <AmountText
                  amountMinor={section.netMinor}
                  signed
                  size={12}
                  color={section.netMinor > 0 ? 'accentText' : 'textSecondary'}
                />
              </View>
            )}
            renderItem={({ item, index }) => (
              <TransactionRow
                tx={item}
                title={titleOf(item)}
                subtitle={listSubtitle(item, entities)}
                divider={index > 0}
              />
            )}
            ListEmptyComponent={
              <EmptyState title={s.list.empty} message={s.list.emptyMessage} icon="cardAlt" />
            }
            ListFooterComponent={
              pages.hasNextPage ? (
                <Pressable
                  onPress={() => void pages.fetchNextPage()}
                  disabled={pages.isFetchingNextPage}
                  accessibilityRole="button"
                  accessibilityState={{ busy: pages.isFetchingNextPage }}
                  testID="transactions.loadMore"
                  style={({ pressed }) => [styles.more, pressed ? styles.morePressed : null]}
                >
                  {pages.isFetchingNextPage ? (
                    <ActivityIndicator color={colors.primaryDark} />
                  ) : (
                    <AppText variant="label" style={styles.moreText}>
                      {s.list.loadMore}
                    </AppText>
                  )}
                </Pressable>
              ) : undefined
            }
          />
        )}
      </View>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
    },
    back: {
      width: size.iconButton,
      height: size.iconButton,
      borderRadius: radius.input,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceBlueSoft,
    },
    backPressed: { opacity: 0.7 },
    bar: {
      gap: 8,
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
      backgroundColor: colors.background,
    },
    list: { paddingTop: 8, paddingHorizontal: 16 },
    placeholder: { paddingTop: 16, paddingHorizontal: 16, gap: 8 },
    dayHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingTop: 8,
      paddingHorizontal: 2,
      marginBottom: 8,
    },
    dayGap: { marginTop: 16 },
    // 12 px, 700, uppercase, letter-spacing .06em (Movimientos h2).
    dayTitle: { fontFamily: fonts.body.bold, letterSpacing: 0.72, textTransform: 'uppercase' },
    more: {
      marginTop: 16,
      height: size.iconButton,
      borderRadius: 15,
      borderWidth: 1.5,
      borderColor: colors.borderBlue,
      backgroundColor: colors.surfaceBlueSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    morePressed: { backgroundColor: colors.surfaceBlue },
    moreText: { fontFamily: fonts.body.bold, color: colors.primaryDeep },
  });
