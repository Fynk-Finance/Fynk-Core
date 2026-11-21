// Billetera tab (design Billetera, inventory row 9), owned by M9 with "Mis cuentas" from M6.
// Blue header with "Gastos fijos de este mes", then "Gastos recurrentes" with "+ Agregar" and
// the 2 column cards of the fixed expenses (an empty card without any), the savings banner when a subscription is marked
// "Casi nunca" (SCRUM-56), and "Otros gastos" with the subscriptions. "Mis cuentas" (M6) and
// "Planes de ahorro" (M8, QA review 2026-11-07, F4; new section, needs design review) go above.
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type ParamListBase,
} from '@react-navigation/native';
import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { formatCop } from '@shared/domain/money';
import { useTabHeader } from '@shared/navigation';
import type { Account, Clock, IsoDate } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  Chip,
  ErrorState,
  GhostCard,
  Screen,
  SectionHeader,
  Skeleton,
  radius,
  spacing,
  useTheme,
  useThemedStyles,
} from '@shared/ui';

import { MisCuentasBilletera } from '@modules/accounts';

import type { RecurringService } from '../application/recurringService';
import { chargedAccount } from '../domain/charges';
import type { StoredRecurringItem } from '../domain/item';
import { DetectedBanner } from './DetectedBanner';
import { RecurringCard } from './RecurringCard';
import { RECURRING_FORM_ROUTE } from './RecurringFormScreen';
import { SUBSCRIPTION_DETAIL_ROUTE } from './SubscriptionDetailScreen';
import { SavingsBanner } from './SavingsBanner';
import { recurringStrings } from './strings.es-CO';
import { accountKind } from './accountLabel';
import { SubscriptionRow } from './SubscriptionRow';
import { useAccounts } from './useAccounts';
import { usePendingProposals } from './usePendingProposals';
import { usePriceUpItems } from './usePriceUpItems';
import { useRecurringItems } from './useRecurringItems';

const t = recurringStrings.billetera;

/** Today's date in Bogotá (UTC-5 all year). */
export function bogotaToday(now: Date): IsoDate {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Route params of the tab: Recomendaciones "Revisar" sends { filter: 'low_use' }. */
export type BilleteraParams = { filter?: 'low_use' };

export interface BilleteraDeps {
  service: RecurringService;
  clock: Clock;
  /** Unread notifications for the bell (M12). */
  useUnreadCount: () => number;
  /** The name typed in onboarding (M3), or null while it loads or when there is none. */
  useDisplayName?: () => string | null;
  accountRoute: string;
  notificationsRoute: string;
  /** The chart button of the header opens Estadísticas (M10), as on every tab. */
  statisticsRoute: string;
  /** The savings banner opens Recomendaciones (inventory row 9). */
  recommendationsRoute: string;
  /** M6 `getAccounts`: the account or card of each subscription. */
  accounts?: () => Promise<Account[]>;
  /** How many detected proposals wait for the person (SCRUM-55), and the screen to review them. */
  pendingProposals?: () => Promise<number>;
  detectedRoute?: string;
  /**
   * Pull to refresh (HU-011): M5's syncNow(). M5 keeps the 60 second cooldown, so Billetera
   * only calls it and reloads.
   */
  refresh?: () => Promise<unknown>;
  /** Ids of the subscriptions with an open price alert (SCRUM-61). */
  priceUpItems?: () => Promise<Set<string>>;
  /**
   * "Planes de ahorro" (QA review 2026-11-07, F4): M8's GoalsCarousel, with the goals not
   * reached yet, "Ver todos" and an empty card without goals.
   */
  renderGoals?: () => ReactNode;
}

export function createBilleteraScreen(deps: BilleteraDeps) {
  return function BilleteraScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const { colors } = useTheme();
    const { state, reload } = useRecurringItems(deps.service);
    const [refreshing, setRefreshing] = useState(false);
    const onRefresh = async () => {
      setRefreshing(true);
      try {
        await deps.refresh?.().catch(() => undefined);
        await reload();
      } finally {
        setRefreshing(false);
      }
    };
    // Recomendaciones "Revisar" opens Billetera with { filter: 'low_use' } (M11).
    const lowUseOnly = (useRoute().params as BilleteraParams | undefined)?.filter === 'low_use';
    const accounts = useAccounts(deps.accounts);
    const detected = usePendingProposals(deps.pendingProposals, state);
    const priceUp = usePriceUpItems(deps.priceUpItems, state);
    const unread = deps.useUnreadCount();
    const name = deps.useDisplayName?.() ?? t.guest;
    const today = bogotaToday(deps.clock.now());
    const add = () => navigation.navigate(RECURRING_FORM_ROUTE);
    const fixed = state.status === 'ready' ? state.items.filter((i) => i.kind === 'fixed') : [];
    const edit = (item: StoredRecurringItem) =>
      navigation.navigate(RECURRING_FORM_ROUTE, { id: item.id });

    // The tabs' shared blue header (QA review 2026-11-07, G2); a plain HeaderBlue outside the tabs.
    const header = useTabHeader({
      name,
      hasUnread: unread > 0,
      onPressAccount: () => navigation.navigate(deps.accountRoute),
      onPressNotifications: () => navigation.navigate(deps.notificationsRoute),
      onPressStatistics: () => navigation.navigate(deps.statisticsRoute),
      title: t.title,
      subtitle: t.subtitle,
      trailing:
        state.status === 'ready' ? (
          <AmountText
            amountMinor={state.monthTotal}
            size={24}
            color="onPrimary"
            testID="recurring.billetera.total"
          />
        ) : null,
    });

    return (
      <Screen header={header} padded={false} gap={0} testID="recurring.billetera">
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          testID="recurring.billetera.scroll"
          refreshControl={
            deps.refresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void onRefresh()}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.background}
              />
            ) : undefined
          }
        >
          <MisCuentasBilletera />
          {deps.renderGoals?.()}
          {detected > 0 && deps.detectedRoute ? (
            <DetectedBanner
              count={detected}
              onPress={() => deps.detectedRoute && navigation.navigate(deps.detectedRoute)}
            />
          ) : null}
          <SectionHeader title={t.recurring} actionLabel={t.add} onAction={add} />
          {state.status === 'loading' ? (
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.skeleton}>
                  <Skeleton height={86} radius={radius.tileLg} />
                </View>
              ))}
            </View>
          ) : state.status === 'error' ? (
            <ErrorState message={t.error} onRetry={() => void reload()} />
          ) : (
            <>
              {fixed.length > 0 ? (
                <View style={styles.grid} testID="recurring.billetera.grid">
                  {fixed.map((item) => (
                    <RecurringCard key={item.id} item={item} today={today} onPress={edit} />
                  ))}
                </View>
              ) : (
                // QA review 2026-11-07, V6: the empty card of the section, as for goals and accounts.
                <GhostCard
                  actionLabel={t.emptyAction}
                  message={t.emptyTitle}
                  onAction={add}
                  style={styles.ghost}
                  testID="recurring.billetera.ghost"
                />
              )}
              {state.subscriptions.lowUseCount > 0 ? (
                <SavingsBanner
                  monthlyMinor={state.subscriptions.lowUseMonthlyMinor}
                  count={state.subscriptions.lowUseCount}
                  onPress={() => navigation.navigate(deps.recommendationsRoute)}
                />
              ) : null}
              {state.subscriptions.count > 0 ? (
                <View style={styles.subscriptions} testID="recurring.billetera.subscriptions">
                  <SectionHeader
                    title={t.subscriptions}
                    meta={
                      <AppText variant="captionStrong" color="textSecondary">
                        {t.subscriptionsMeta(
                          state.subscriptions.count,
                          formatCop(state.subscriptions.monthlyMinor),
                        )}
                      </AppText>
                    }
                  />
                  {lowUseOnly ? (
                    <View style={styles.filter}>
                      <Chip
                        label={t.lowUseOnly}
                        selected
                        onPress={() => navigation.setParams({ filter: undefined })}
                        testID="recurring.billetera.lowUseFilter"
                      />
                      <AppText variant="caption" color="textSecondary">
                        {t.lowUseOnlyHint}
                      </AppText>
                    </View>
                  ) : null}
                  {state.items
                    .filter((item) => item.kind === 'subscription')
                    .filter((item) => !lowUseOnly || item.usage === 'low')
                    .map((item) => (
                      <SubscriptionRow
                        key={item.id}
                        item={item}
                        today={today}
                        account={accountKind(chargedAccount(item, accounts))}
                        priceUp={priceUp.has(item.id)}
                        onPress={() =>
                          navigation.navigate(SUBSCRIPTION_DETAIL_ROUTE, { id: item.id })
                        }
                      />
                    ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </Screen>
    );
  };
}

const createStyles = () =>
  StyleSheet.create({
    // What Screen gives a padded scroll above the tab bar, here with the pull to refresh.
    content: {
      paddingHorizontal: spacing.screen,
      paddingTop: spacing.block,
      paddingBottom: spacing.tabBarClearance,
      gap: spacing.md,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    skeleton: { flexBasis: '48%', flexGrow: 1 },
    ghost: { borderRadius: radius.tileLg },
    subscriptions: { gap: spacing.md, marginTop: spacing.md },
    filter: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.md },
  });
