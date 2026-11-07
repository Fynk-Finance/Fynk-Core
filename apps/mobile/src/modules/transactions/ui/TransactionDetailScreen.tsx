// Detalle de movimiento, from a row of Movimientos, the Dashboard or Detalle de cuenta. Pushed
// with the default transition. The design has no such screen (README, screens the design does
// not have yet), so it is built from shared components: new screen, needs design review.
// Amount, date and time, account, description, merchant, state, the category with "Cambiar
// categoría", and the history of category changes.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { categoryLabel } from '@shared/domain/categories';
import type { Id } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Card,
  EmptyState,
  ErrorState,
  GhostButton,
  Icon,
  Skeleton,
  radius,
  size,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import type { TransactionHooks } from '../application/useTransactions';
import { iconOf } from './categoryIcons';
import {
  accountLabel,
  dateTimeLabel,
  historyLine,
  knownAccounts,
  titleOf,
  type AccountsData,
} from './labels';
import { CATEGORY_ROUTE, NEW_TRANSACTION_ROUTE } from './routes';
import { transactionsStrings } from './strings.es-CO';

const t = transactionsStrings.detail;
const m = transactionsStrings.manual;

export interface TransactionDetailParams {
  id: Id;
}

export interface TransactionDetailDeps {
  hooks: Pick<TransactionHooks, 'useTransaction' | 'useCategoryHistory'>;
  useAccounts: () => { data?: AccountsData };
  /** Deletes a manual movement. */
  deleteManual: (id: Id) => Promise<void>;
  /** Alert.alert, replaced in tests. */
  ask?: typeof Alert.alert;
}

export function createTransactionDetailScreen({
  hooks,
  useAccounts,
  deleteManual,
  ask = Alert.alert,
}: TransactionDetailDeps) {
  return function TransactionDetailScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute<RouteProp<{ detail: TransactionDetailParams }, 'detail'>>();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const styles = useThemedStyles(createStyles);
    const id = route.params.id;
    const query = hooks.useTransaction(id);
    const history = hooks.useCategoryHistory(id).data ?? [];
    const accounts = knownAccounts(useAccounts().data);
    const tx = query.data;
    const account = tx ? accounts.find((a) => a.id === tx.accountId) : undefined;

    let body: ReactNode;
    if (query.isPending) {
      body = (
        <View style={styles.gap} testID="transactions.detail.loading">
          <Skeleton height={80} radius={18} />
          <Skeleton height={200} radius={18} />
        </View>
      );
    } else if (query.isError) {
      body = <ErrorState message={t.error} onRetry={() => void query.refetch()} />;
    } else if (!tx) {
      body = <EmptyState title={t.gone} icon="cardAlt" />;
    } else {
      const income = tx.amountMinor > 0;
      body = (
        <View style={styles.gap}>
          <View style={styles.hero}>
            <View style={[styles.tile, income ? styles.tileIncome : null]}>
              <Icon
                name={iconOf(tx.categoryId, tx.amountMinor)}
                size={24}
                strokeWidth={2}
                color={income ? colors.accentText : colors.primaryDark}
              />
            </View>
            <AppText variant="cardTitle" numberOfLines={2} style={styles.center}>
              {titleOf(tx)}
            </AppText>
            <AmountText
              amountMinor={tx.amountMinor}
              signed
              size={34}
              testID="transactions.detail.amount"
            />
            <AppText variant="small" color="textSecondary">
              {dateTimeLabel(tx.bookedAt)}
            </AppText>
          </View>

          <Card>
            <Line label={t.account} value={account ? accountLabel(account) : '—'} />
            <Line label={t.description} value={tx.description} />
            <Line label={t.merchant} value={tx.merchantRaw?.trim() || '—'} />
            <Line
              label={t.status}
              value={
                tx.source === 'manual' ? t.manual : tx.status === 'pending' ? t.pending : t.booked
              }
            />
            <View style={styles.categoryRow}>
              <View style={styles.flex}>
                <AppText variant="caption" color="textSecondary">
                  {t.category}
                </AppText>
                <AppText variant="label" testID="transactions.detail.category">
                  {categoryLabel(tx.categoryId)}
                </AppText>
              </View>
              <GhostButton
                label={t.changeCategory}
                size="md"
                onPress={() => navigation.navigate(CATEGORY_ROUTE, { id: tx.id })}
                testID="transactions.detail.changeCategory"
              />
            </View>
          </Card>

          {tx.source === 'manual' ? (
            <View style={styles.actions}>
              <View style={styles.flex}>
                <GhostButton
                  label={m.edit}
                  onPress={() => navigation.navigate(NEW_TRANSACTION_ROUTE, { id: tx.id })}
                  testID="transactions.detail.edit"
                />
              </View>
              <View style={styles.flex}>
                <GhostButton
                  label={m.delete}
                  tone="danger"
                  testID="transactions.detail.delete"
                  onPress={() =>
                    ask(m.deleteTitle, m.deleteMessage, [
                      { text: m.cancel, style: 'cancel' },
                      {
                        text: m.delete,
                        style: 'destructive',
                        onPress: () => {
                          deleteManual(tx.id).then(
                            () => navigation.goBack(),
                            () => undefined,
                          );
                        },
                      },
                    ])
                  }
                />
              </View>
            </View>
          ) : null}

          {history.length > 0 ? (
            <View style={styles.history} testID="transactions.detail.history">
              <AppText variant="smallStrong" accessibilityRole="header">
                {t.history}
              </AppText>
              {history.map((change) => (
                <AppText key={change.id} variant="small" color="textSecondary">
                  {historyLine(change)}
                </AppText>
              ))}
            </View>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.root} testID="transactions.detail">
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <AppText variant="screenTitle" accessibilityRole="header">
            {t.title}
          </AppText>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t.back}
            hitSlop={4}
            style={({ pressed }) => [styles.back, pressed ? styles.backPressed : null]}
          >
            <Icon name="chevronLeft" size={24} strokeWidth={2.4} color={colors.primaryDark} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}>
          {body}
        </ScrollView>
      </View>
    );
  };
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={lineStyles.line}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="label" numberOfLines={2}>
        {value}
      </AppText>
    </View>
  );
}

const lineStyles = StyleSheet.create({ line: { gap: 2, paddingVertical: 6 } });

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
    content: { paddingTop: 20, paddingHorizontal: 16 },
    gap: { gap: 16 },
    hero: { alignItems: 'center', gap: 6, paddingVertical: 8 },
    center: { textAlign: 'center' },
    tile: {
      width: 56,
      height: 56,
      borderRadius: radius.tileLg,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceBlueSoft,
      marginBottom: 4,
    },
    tileIncome: { backgroundColor: colors.accentTint },
    categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 6 },
    flex: { flex: 1 },
    history: { gap: 6 },
    actions: { flexDirection: 'row', gap: 12 },
  });
