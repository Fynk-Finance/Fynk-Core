// Dashboard tab (design Dashboard, inventory row 5), owned by M6: the blue header with
// "Hola, <nombre>" and the bell, and the "Balance total" card. Planes de ahorro (M8) and
// Movimientos (M7) go below when those modules export them.
import { useNavigation, type NavigationProp, type ParamListBase } from '@react-navigation/native';
import type { UseQueryResult } from '@tanstack/react-query';

import { ErrorState, HeaderBlue, Screen, spacing } from '@shared/ui';

import type { AccountsOverview } from '../application/accountsService';
import type { MonthSummary } from '../domain/dashboard';
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
}

export function createDashboardScreen(deps: DashboardDeps) {
  return function DashboardScreen() {
    const navigation = useNavigation<NavigationProp<ParamListBase>>();
    const accounts = deps.useAccounts();
    const summary = deps.useMonthSummary();
    const unread = deps.useUnreadCount();
    const name = deps.useDisplayName() ?? t.guest;
    const overview = accounts.data;

    const header = (
      <HeaderBlue
        dashboard
        name={name}
        hasUnread={unread > 0}
        onPressAccount={() => navigation.navigate(deps.accountRoute)}
        onPressNotifications={() => navigation.navigate(deps.notificationsRoute)}
      >
        <DashboardBalanceCard
          totalMinor={overview?.balanceTotalMinor ?? null}
          connectedCount={overview?.connectedCount ?? 0}
          summary={summary}
        />
      </HeaderBlue>
    );

    // TODO(M5) pull to refresh starts a sync once M5 exports it (CLAUDE.md rule 4).
    return (
      <Screen header={header} scroll withTabBar padded gap={spacing.block}>
        {accounts.isError ? (
          <ErrorState message={t.loadError} onRetry={() => void accounts.refetch()} />
        ) : null}
      </Screen>
    );
  };
}
