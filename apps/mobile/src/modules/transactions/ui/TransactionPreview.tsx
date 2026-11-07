// "Movimientos" of the Dashboard (design: Dashboard, inventory row 5): the title, "Ver todo"
// (opens Movimientos) and the 3 latest movements, "<cuenta> · <fecha>" under each one.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, SectionHeader, Skeleton } from '@shared/ui';

import type { TransactionHooks } from '../application/useTransactions';
import type { TransactionFilter } from '../domain/query';
import { DETAIL_ROUTE, TRANSACTIONS_ROUTE } from './routes';
import { knownAccounts, previewSubtitle, titleOf, type AccountsData } from './labels';
import { transactionsStrings as s } from './strings.es-CO';
import { TransactionRow } from './TransactionRow';

export const PREVIEW_ROWS = 3;
const ALL: TransactionFilter = {};

export interface TransactionPreviewDeps {
  hooks: Pick<TransactionHooks, 'useTransactionPages'>;
  useAccounts: () => { data?: AccountsData };
}

export function createTransactionPreview({ hooks, useAccounts }: TransactionPreviewDeps) {
  return function TransactionPreview() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const pages = hooks.useTransactionPages(ALL, PREVIEW_ROWS);
    const data = useAccounts().data;
    const kinds = useMemo(() => new Map(knownAccounts(data).map((a) => [a.id, a.kind])), [data]);
    const items = pages.data?.pages[0]?.items ?? [];

    return (
      <View style={styles.section} testID="transactions.preview">
        <View style={styles.header}>
          <SectionHeader
            title={s.preview.title}
            actionLabel={s.preview.seeAll}
            onAction={() => navigation.navigate(TRANSACTIONS_ROUTE)}
          />
        </View>
        {pages.isPending ? (
          <View style={styles.rows}>
            <Skeleton height={64} radius={14} />
            <Skeleton height={64} radius={14} />
          </View>
        ) : items.length === 0 ? (
          <AppText variant="small" color="textSecondary">
            {s.preview.empty}
          </AppText>
        ) : (
          <View style={styles.rows}>
            {items.map((tx) => (
              <TransactionRow
                key={tx.id}
                tx={tx}
                variant="preview"
                title={titleOf(tx)}
                subtitle={previewSubtitle(tx, kinds)}
                onPress={(row) => navigation.navigate(DETAIL_ROUTE, { id: row.id })}
              />
            ))}
          </View>
        )}
      </View>
    );
  };
}

const styles = StyleSheet.create({
  section: { flexShrink: 0 },
  header: { marginBottom: 8 },
  rows: { gap: 8 },
});
