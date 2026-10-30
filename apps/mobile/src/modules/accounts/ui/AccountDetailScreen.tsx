// Detalle de cuenta (design CuentaDetalle, inventory row 12): a modal over the Dashboard with
// one card per account. Page dots or a horizontal swipe change account; the chevron or a swipe
// down closes it. Cards also show their credit data (HU-019). Movimientos comes from M7.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
  type RouteProp,
} from '@react-navigation/native';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';

import type { Account, Clock, Id, IsoDate, IsoDateTime } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Badge,
  Card,
  EmptyState,
  Icon,
  PageDots,
  Screen,
  Shine,
  fonts,
  initialsOf,
  radius,
  size,
  spacing,
  uiStrings,
  useTheme,
  useThemedStyles,
  type Theme,
} from '@shared/ui';

import { entityOf } from '../domain/dashboard';
import { maskedNumber } from '../domain/masking';
import { bogotaDate } from '../domain/syncedAccounts';
import type { AccountsOverview } from '../application/accountsService';
import { accountsStrings } from './strings.es-CO';

const t = accountsStrings.detail;

export const ACCOUNT_DETAIL_ROUTE = 'accounts.AccountDetail' as const;
export type AccountDetailParams = { accountId: Id };

/** "5 nov" from an ISO date. */
export function shortDay(date: IsoDate): string {
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${t.months[month! - 1]}`;
}

/** "Actualizado hace 5 min", or null for cash, which is never synced. */
export function updatedLabel(lastSyncedAt: IsoDateTime | null, now: Date): string | null {
  if (!lastSyncedAt) return null;
  const minutes = Math.floor((now.getTime() - Date.parse(lastSyncedAt)) / 60_000);
  if (minutes < 1) return t.updatedNow;
  if (minutes < 60) return t.updatedMinutes(minutes);
  if (minutes < 24 * 60) return t.updatedHours(Math.floor(minutes / 60));
  return t.updatedOn(shortDay(bogotaDate(new Date(lastSyncedAt))));
}

/** The page a horizontal swipe lands on: left goes to the next account, right to the previous. */
export function swipeTarget(index: number, count: number, translationX: number): number {
  if (translationX < -40) return Math.min(index + 1, count - 1);
  if (translationX > 40) return Math.max(index - 1, 0);
  return index;
}

export interface AccountDetailDeps {
  useAccounts: () => Pick<UseQueryResult<AccountsOverview>, 'data'>;
  clock: Clock;
  /** M7's TransactionList filtered by the account, with pull to refresh. */
  renderTransactions?: (accountId: Id) => ReactNode;
}

export function createAccountDetailScreen(deps: AccountDetailDeps) {
  return function AccountDetailScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const route = useRoute<RouteProp<{ detail: AccountDetailParams }, 'detail'>>();
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    // Same accounts as Detalle de cuentas: CDTs live in the Inversión tab.
    const pages = (deps.useAccounts().data?.accounts ?? []).filter((a) => a.kind !== 'cdt');
    const [index, setIndex] = useState(() =>
      Math.max(
        0,
        pages.findIndex((a) => a.id === route.params.accountId),
      ),
    );
    const current = pages[Math.min(index, pages.length - 1)];
    const swipe = usePanGesture({
      runOnJS: true,
      activeOffsetX: [-15, 15],
      failOffsetY: [-15, 15],
      onDeactivate: (e) => setIndex((i) => swipeTarget(i, pages.length, e.translationX)),
    });

    const hero = (
      <View style={[styles.hero, { paddingTop: insets.top + spacing.screen }]}>
        <Svg width={390} height={300} style={StyleSheet.absoluteFill}>
          <Rect x={262} y={-90} width={210} height={210} rx={48} fill={colors.headerShapeA} />
          <Rect x={-70} y={190} width={150} height={150} rx={36} fill={colors.primaryPressed} />
        </Svg>
        <View style={styles.top}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t.close}
            style={styles.close}
            testID="accounts.detail.close"
          >
            <View style={styles.flipped}>
              <Icon name="chevronDown" size={24} strokeWidth={2.4} color={colors.onPrimary} />
            </View>
          </Pressable>
          <AppText variant="headerTitle" color="onPrimary">
            {t.title}
          </AppText>
          <View style={styles.close} />
        </View>
        {current ? (
          <GestureDetector gesture={swipe}>
            <View>
              <AccountCard account={current} now={deps.clock.now()} />
            </View>
          </GestureDetector>
        ) : null}
        {pages.length > 1 ? (
          <PageDots
            labels={pages.map((a) => t.show(entityOf(a)))}
            index={index}
            onSelect={setIndex}
          />
        ) : null}
      </View>
    );

    return (
      <Screen header={hero} scroll gap={spacing.section}>
        {!current ? <EmptyState title={t.gone} icon="bank" /> : null}
        {current?.kind === 'credit_card' ? <CreditData account={current} /> : null}
        {/* TODO(M7) TransactionList filtered by this account, with pull to refresh. */}
        {current && deps.renderTransactions ? deps.renderTransactions(current.id) : null}
      </Screen>
    );
  };
}

function AccountCard({ account, now }: { account: Account; now: Date }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const entity = entityOf(account);
  const isCard = account.kind === 'credit_card';
  const amount = isCard ? (account.availableMinor ?? 0) : account.balanceMinor;
  const masked = maskedNumber(account.last4);
  const updated = updatedLabel(account.lastSyncedAt, now);
  return (
    <View style={styles.card} testID="accounts.detail.card">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width={300} height={184}>
          <Rect x={178} y={-80} width={176} height={176} rx={44} fill={colors.cardShapeLight} />
          <Rect x={234} y={-36} width={100} height={100} rx={26} fill={colors.cardShapeLighter} />
          <Rect x={-48} y={132} width={110} height={110} rx={28} fill={colors.headerShapeB} />
        </Svg>
        <Shine distance={470} height={280} width={50} opacity={0.16} />
      </View>
      <View style={styles.row}>
        <View style={styles.tile}>
          <AppText variant="label" color="primary" style={styles.initials}>
            {initialsOf(entity)}
          </AppText>
        </View>
        <View style={styles.names}>
          <AppText variant="label" color="onPrimary" style={styles.entity} numberOfLines={1}>
            {entity}
          </AppText>
          <View style={styles.row}>
            <AppText variant="caption" color="onPrimary" style={styles.soft} numberOfLines={1}>
              {account.kind === 'cash'
                ? accountsStrings.dashboard.cashDetail
                : accountsStrings.kinds[account.kind]}
            </AppText>
            {account.isSimulated ? (
              <Badge label={uiStrings.simulated} tone="onPrimary" size="sm" />
            ) : null}
          </View>
        </View>
      </View>
      <View>
        <AppText variant="captionStrong" color="onPrimary" style={styles.soft}>
          {isCard ? t.creditAvailable : t.available}
        </AppText>
        <AmountText
          amountMinor={amount}
          size={30}
          color="onPrimary"
          testID="accounts.detail.amount"
        />
      </View>
      <View style={styles.spread}>
        <AppText variant="captionStrong" color="onPrimary" style={styles.number}>
          {masked ?? ''}
        </AppText>
        {updated ? (
          <AppText variant="caption" color="onPrimary" style={styles.soft}>
            {updated}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function CreditData({ account }: { account: Account }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Card testID="accounts.detail.credit">
      <View style={styles.spread}>
        <AppText variant="small" color="textSecondary">
          {t.creditLimit}
        </AppText>
        <AmountText amountMinor={account.creditLimitMinor ?? 0} />
      </View>
      {account.paymentDueOn ? (
        <AppText variant="smallStrong" style={styles.due}>
          {t.paymentDue(shortDay(account.paymentDueOn))}
        </AppText>
      ) : null}
    </Card>
  );
}

const createStyles = ({ colors, shadow }: Theme) =>
  StyleSheet.create({
    hero: {
      backgroundColor: colors.primary,
      borderBottomLeftRadius: radius.sheetSm,
      borderBottomRightRadius: radius.sheetSm,
      paddingHorizontal: spacing.screen,
      paddingBottom: spacing.xl,
      gap: spacing.xl,
      alignItems: 'center',
      overflow: 'hidden',
    },
    top: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    close: {
      width: size.iconButton,
      height: size.iconButton,
      borderRadius: radius.input,
      backgroundColor: colors.onPrimaryOverlay,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flipped: { transform: [{ rotate: '180deg' }] },
    card: {
      width: 300,
      height: 184,
      padding: 16,
      borderRadius: radius.cardLg,
      backgroundColor: colors.primaryLight,
      justifyContent: 'space-between',
      overflow: 'hidden',
      ...shadow.card,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    tile: {
      width: 40,
      height: 40,
      borderRadius: radius.tile,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initials: { fontFamily: fonts.heading.bold },
    names: { flex: 1, gap: 1 },
    entity: { fontFamily: fonts.body.bold, fontSize: 16, lineHeight: 20 },
    soft: { opacity: 0.92 },
    spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    number: { fontFamily: fonts.amount.semibold, letterSpacing: 0.72 },
    due: { marginTop: spacing.md },
  });
