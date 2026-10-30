// Billetera tab (design Billetera, inventory row 9), owned by M9 with "Mis cuentas" from M6.
// Blue header with "Gastos fijos de este mes", then "Gastos recurrentes" with "+ Agregar" and
// the 2 column cards of the fixed expenses, the savings banner when a subscription is marked
// "Casi nunca" (SCRUM-56), and "Otros gastos" with the subscriptions. M6 adds "Mis cuentas"
// above when it lands.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import { StyleSheet, View } from 'react-native';

import { formatCop } from '@shared/domain/money';
import type { Clock, IsoDate } from '@shared/domain/types';
import {
  AmountText,
  AppText,
  EmptyState,
  ErrorState,
  HeaderBlue,
  Screen,
  SectionHeader,
  Skeleton,
  radius,
  spacing,
  useThemedStyles,
} from '@shared/ui';

import { MisCuentasBilletera } from '@modules/accounts';

import type { RecurringService } from '../application/recurringService';
import type { StoredRecurringItem } from '../domain/item';
import { RecurringCard } from './RecurringCard';
import { RECURRING_FORM_ROUTE } from './RecurringFormScreen';
import { SUBSCRIPTION_DETAIL_ROUTE } from './SubscriptionDetailScreen';
import { SavingsBanner } from './SavingsBanner';
import { recurringStrings } from './strings.es-CO';
import { SubscriptionRow } from './SubscriptionRow';
import { useRecurringItems } from './useRecurringItems';

const t = recurringStrings.billetera;

/** Today's date in Bogotá (UTC-5 all year). */
export function bogotaToday(now: Date): IsoDate {
  return new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export interface BilleteraDeps {
  service: RecurringService;
  clock: Clock;
  /** Unread notifications for the bell (M12). */
  useUnreadCount: () => number;
  accountRoute: string;
  notificationsRoute: string;
  /** The savings banner opens Recomendaciones (inventory row 9). */
  recommendationsRoute: string;
}

export function createBilleteraScreen(deps: BilleteraDeps) {
  return function BilleteraScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const styles = useThemedStyles(createStyles);
    const { state, reload } = useRecurringItems(deps.service);
    const unread = deps.useUnreadCount();
    const today = bogotaToday(deps.clock.now());
    const add = () => navigation.navigate(RECURRING_FORM_ROUTE);
    const edit = (item: StoredRecurringItem) =>
      navigation.navigate(RECURRING_FORM_ROUTE, { id: item.id });

    const header = (
      <HeaderBlue
        name={t.guest}
        hasUnread={unread > 0}
        onPressAccount={() => navigation.navigate(deps.accountRoute)}
        onPressNotifications={() => navigation.navigate(deps.notificationsRoute)}
        title={t.title}
        subtitle={t.subtitle}
        trailing={
          state.status === 'ready' ? (
            <AmountText
              amountMinor={state.monthTotal}
              size={24}
              color="onPrimary"
              testID="recurring.billetera.total"
            />
          ) : null
        }
      />
    );

    return (
      <Screen
        header={header}
        scroll
        withTabBar
        padded
        gap={spacing.md}
        testID="recurring.billetera"
      >
        <MisCuentasBilletera />
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
        ) : state.items.length === 0 ? (
          <EmptyState
            title={t.emptyTitle}
            message={t.emptyMessage}
            icon="calendar"
            actionLabel={t.emptyAction}
            onAction={add}
          />
        ) : (
          <>
            <View style={styles.grid} testID="recurring.billetera.grid">
              {state.items
                .filter((item) => item.kind === 'fixed')
                .map((item) => (
                  <RecurringCard key={item.id} item={item} today={today} onPress={edit} />
                ))}
            </View>
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
                {state.items
                  .filter((item) => item.kind === 'subscription')
                  .map((item) => (
                    <SubscriptionRow
                      key={item.id}
                      item={item}
                      today={today}
                      onPress={() =>
                        navigation.navigate(SUBSCRIPTION_DETAIL_ROUTE, { id: item.id })
                      }
                    />
                  ))}
              </View>
            ) : null}
          </>
        )}
      </Screen>
    );
  };
}

const createStyles = () =>
  StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
    skeleton: { flexBasis: '48%', flexGrow: 1 },
    subscriptions: { gap: spacing.md, marginTop: spacing.md },
  });
