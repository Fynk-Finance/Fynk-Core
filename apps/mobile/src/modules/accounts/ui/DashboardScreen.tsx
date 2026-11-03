// Dashboard tab (design Dashboard, inventory rows 5 and 6), owned by M6: the blue header with
// "Hola, <nombre>" and the bell, the "Balance total" card and Detalle de cuentas, which expands
// in place. Below, Movimientos (M7's preview), and the FAB "Registrar gasto o ingreso", which
// opens M7's sheet. Planes de ahorro (M8) goes there too when M8 exports it.
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
  useMonthSummary: () => MonthSummary;
  /** Unread notifications for the bell (M12). */
  useUnreadCount: () => number;
  useDisplayName: () => string | null;
  accountRoute: string;
  notificationsRoute: string;
  /** "Movimientos" with the latest movements (M7's TransactionPreview). */
  renderMovements?: () => ReactNode;
  /** The route of M7's "Registrar gasto o ingreso" sheet. Read at press time. */
  newMovementRoute?: () => string;
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

    const header = (
      <View>
        <HeaderBlue
          dashboard
          name={name}
          hasUnread={unread > 0}
          onPressAccount={() => navigation.navigate(deps.accountRoute)}
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
                />
              </Animated.View>
            ) : null}
          </Animated.View>
        </HeaderBlue>
        <DetailsTab expanded={expanded} onToggle={() => setExpanded((open) => !open)} />
      </View>
    );

    const newMovementRoute = deps.newMovementRoute;
    // TODO(M5) pull to refresh starts a sync once M5 exports it (CLAUDE.md rule 4).
    return (
      <View style={styles.root}>
        <Screen header={header} scroll withTabBar padded gap={spacing.block}>
          {accounts.isError ? (
            <ErrorState message={t.loadError} onRetry={() => void accounts.refetch()} />
          ) : null}
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
  // right 16, bottom 92: above the tab bar (Dashboard `.fab`).
  fab: { position: 'absolute', right: 16, bottom: 92 },
});
