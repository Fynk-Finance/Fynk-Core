// Dashboard tab (design Dashboard, inventory rows 5 and 6), owned by M6: the blue header with
// "Hola, <nombre>", the chart icon that opens Estadísticas (M10) and the bell, the "Balance total" card and Detalle de cuentas, which expands
// in place. Below, Planes de ahorro (M8's carousel), Movimientos (M7's preview), and the FAB
// "Registrar gasto o ingreso", which opens M7's sheet.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import type { UseQueryResult } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { ErrorState, Fab, HeaderBlue, Screen, motion, spacing } from '@shared/ui';

import type { AccountsOverview } from '../application/accountsService';
import { accountRows, type MonthSummary } from '../domain/dashboard';
import { ACCOUNT_DETAIL_ROUTE } from './AccountDetailScreen';
import { AccountsPanel, DetailsTab } from './AccountsPanel';
import { DashboardBalanceCard } from './DashboardBalanceCard';
import { accountsStrings } from './strings.es-CO';

const t = accountsStrings.dashboard;

export interface DashboardDeps {
  useAccounts: () => Pick<UseQueryResult<AccountsOverview>, 'data' | 'isError' | 'refetch'>;
  /** null while M10 computes the month. */
  useMonthSummary: () => MonthSummary | null;
  /** Unread notifications for the bell (M12). */
  useUnreadCount: () => number;
  useDisplayName: () => string | null;
  accountRoute: string;
  notificationsRoute: string;
  /** Estadísticas (M10), opened from the chart icon of the header. */
  statisticsRoute: string;
  /**
   * M5's Conectar banco, opened from the ghost card while no bank account is connected. Read at
   * press time.
   */
  connectRoute?: () => string;
  /** "Planes de ahorro" with the goals not reached yet (M8's GoalsCarousel). */
  renderGoals?: () => ReactNode;
  /** "Movimientos" with the latest movements (M7's TransactionPreview). */
  renderMovements?: () => ReactNode;
  /** The route of M7's "Registrar gasto o ingreso" sheet. Read at press time. */
  newMovementRoute?: () => string;
  /**
   * Pull to refresh (HU-011): M5's syncNow(). M5 keeps the 60 second cooldown; the accounts
   * are read again afterwards.
   */
  refresh?: () => Promise<unknown>;
}

export function createDashboardScreen(deps: DashboardDeps) {
  return function DashboardScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const [expanded, setExpanded] = useState(false);
    const accounts = deps.useAccounts();
    const summary = deps.useMonthSummary();
    const unread = deps.useUnreadCount();
    const name = deps.useDisplayName() ?? t.guest;
    const overview = accounts.data;
    const connectRoute = deps.connectRoute;
    const onConnect =
      connectRoute && overview && overview.connectedCount === 0
        ? () => navigation.navigate(connectRoute())
        : undefined;

    const header = (
      <View>
        <HeaderBlue
          dashboard
          name={name}
          hasUnread={unread > 0}
          onPressAccount={() => navigation.navigate(deps.accountRoute)}
          onPressStatistics={() => navigation.navigate(deps.statisticsRoute)}
          onPressNotifications={() => navigation.navigate(deps.notificationsRoute)}
        >
          <Animated.View layout={LinearTransition.duration(motion.slow)}>
            <DashboardBalanceCard
              totalMinor={overview?.balanceTotalMinor ?? null}
              connectedCount={overview?.connectedCount ?? 0}
              summary={summary}
            />
            {expanded ? (
              <Animated.View
                entering={FadeIn.duration(motion.slow)}
                exiting={FadeOut.duration(motion.fast)}
              >
                <AccountsPanel
                  rows={accountRows(overview?.accounts ?? [])}
                  onPressRow={(accountId) =>
                    navigation.navigate(ACCOUNT_DETAIL_ROUTE, { accountId })
                  }
                  onConnect={onConnect}
                />
              </Animated.View>
            ) : null}
          </Animated.View>
        </HeaderBlue>
        <DetailsTab expanded={expanded} onToggle={() => setExpanded((open) => !open)} />
      </View>
    );

    const newMovementRoute = deps.newMovementRoute;
    const sync = deps.refresh;
    const refresh = sync
      ? async () => {
          await sync().catch(() => undefined);
          await accounts.refetch();
        }
      : undefined;
    return (
      <View style={styles.root}>
        <Screen
          header={header}
          scroll
          withTabBar
          padded
          gap={spacing.block}
          refresh={refresh}
          testID="accounts.dashboard"
        >
          {accounts.isError ? (
            <ErrorState message={t.loadError} onRetry={() => void accounts.refetch()} />
          ) : null}
          {deps.renderGoals?.()}
          {deps.renderMovements?.()}
        </Screen>
        {newMovementRoute ? (
          <Fab
            accessibilityLabel={t.newMovement}
            onPress={() => navigation.navigate(newMovementRoute())}
            style={styles.fab}
            testID="accounts.dashboard.fab"
          />
        ) : null}
      </View>
    );
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Right 16 like the design (`.fab`). The design's bottom 92 counts its 72 px tab bar, which
  // overlaps the page there; here the bar sits below the page, so 12 px keeps the FAB just above
  // it (QA review 2026-11-07, V1).
  fab: { position: 'absolute', right: 16, bottom: 12 },
});
