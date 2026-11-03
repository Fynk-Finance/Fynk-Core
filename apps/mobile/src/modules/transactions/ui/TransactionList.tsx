// The movements of a filter as a section that opens and closes ("Movimientos" of Detalle de
// cuenta, design CuentaDetalle): the title, a pill with the count, the chevron, and rows
// "<fecha> · <categoría>" with "Cargar 20 más". It draws plain views, not a list, because it
// sits inside the screen's own scroll.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  AppText,
  Icon,
  Skeleton,
  motion,
  radius,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { TransactionHooks } from '../application/useTransactions';
import type { TransactionFilter } from '../domain/query';
import { accountSubtitle, titleOf } from './labels';
import { transactionsStrings as s } from './strings.es-CO';
import { LoadMoreButton } from './LoadMoreButton';
import { TransactionRow } from './TransactionRow';

export interface TransactionListProps {
  filter: TransactionFilter;
  /** Open when it first shows, as in the design. */
  initiallyOpen?: boolean;
}

export function createTransactionList({
  hooks,
}: {
  hooks: Pick<TransactionHooks, 'useTransactionPages' | 'useTransactionSummary'>;
}) {
  return function TransactionList({ filter, initiallyOpen = true }: TransactionListProps) {
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const [open, setOpen] = useState(initiallyOpen);
    const pages = hooks.useTransactionPages(filter);
    const summary = hooks.useTransactionSummary(filter);
    const items = pages.data?.pages.flatMap((p) => p.items) ?? [];
    const count = summary.data?.count;

    return (
      <View style={styles.section} testID="transactions.accountList">
        <Pressable
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={
            count === undefined ? s.account.title : `${s.account.title}, ${s.account.count(count)}`
          }
          style={styles.toggle}
        >
          <AppText variant="cardTitle" style={styles.title}>
            {s.account.title}
          </AppText>
          {count !== undefined ? (
            <View style={styles.pill}>
              <AppText variant="overline" style={styles.pillText}>
                {count}
              </AppText>
            </View>
          ) : null}
          <View style={open ? styles.chevronOpen : null}>
            <Icon name="chevronDown" size={24} strokeWidth={2.4} color={colors.textSecondary} />
          </View>
        </Pressable>
        {open ? (
          <Animated.View entering={FadeIn.duration(motion.slow + 50)} style={styles.rows}>
            {pages.isPending ? (
              <>
                <Skeleton height={56} radius={12} />
                <Skeleton height={56} radius={12} />
              </>
            ) : items.length === 0 ? (
              <AppText variant="small" color="textSecondary" style={styles.empty}>
                {s.account.empty}
              </AppText>
            ) : (
              items.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  tx={tx}
                  variant="account"
                  title={titleOf(tx)}
                  subtitle={accountSubtitle(tx)}
                />
              ))
            )}
            {pages.hasNextPage ? (
              <LoadMoreButton
                loading={pages.isFetchingNextPage}
                onPress={() => void pages.fetchNextPage()}
              />
            ) : null}
          </Animated.View>
        ) : null}
      </View>
    );
  };
}

const createStyles = ({ colors }: Theme) =>
  StyleSheet.create({
    section: { borderRadius: radius.card, backgroundColor: colors.background, overflow: 'hidden' },
    toggle: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 16 },
    // Space Grotesk 700, 18/24 (CuentaDetalle).
    title: { flex: 1, fontSize: 18, lineHeight: 24 },
    pill: {
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: radius.pill,
      backgroundColor: colors.surfaceBlue,
    },
    pillText: { color: colors.primaryDark, letterSpacing: 0, textTransform: 'none' },
    chevronOpen: { transform: [{ rotate: '180deg' }] },
    rows: { paddingVertical: 8 },
    empty: { paddingVertical: 8 },
  });
