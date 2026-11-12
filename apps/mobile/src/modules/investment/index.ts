// Public API of the investment module (M15). Other modules import only from this file.
import type { Clock } from '@shared/domain';
import { appEvents } from '@shared/events/appEvents';
import type { ModuleRoutes } from '@shared/navigation';

import { getBalanceHistory, getCdtAccounts } from '@modules/accounts';
import { STATISTICS_ROUTE } from '@modules/analytics';
import { NOTIFICATIONS_ROUTE, useUnreadCount } from '@modules/notifications';
import { useDisplayName as useOnboardingName } from '@modules/onboarding';

import { createMarketApi } from './adapters/api/marketApi';
import { setInvestmentDeps } from './application/hooks';
import type { AccountsPort } from './application/ports';
import { totalPerDay } from './domain/investment';
import { createInvestmentScreen } from './ui/InvestmentScreen';
import { investmentStrings } from './ui/strings.es-CO';

export type { AccountsPort };

/** The name typed in onboarding (M3), or "Invitado". Read only while the screen renders. */
function useHeaderName(): string {
  return useOnboardingName() ?? investmentStrings.guestName;
}

let displayName: () => string = useHeaderName;

export const routes: ModuleRoutes = {
  module: 'investment',
  tab: createInvestmentScreen({
    useDisplayName: () => displayName(),
    // The bell is M12's and the chart opens M10's Estadísticas, as on the other tabs.
    useUnreadCount: () => useUnreadCount(),
    accountRoute: 'identity.Account',
    notificationsRoute: NOTIFICATIONS_ROUTE,
    statisticsRoute: STATISTICS_ROUTE,
  }),
};

export interface InvestmentConfig {
  accounts: AccountsPort; // M6 getCdtAccounts()
  clock: Clock;
  /** Banco Demo portal base, e.g. https://bancodemo.fynk.co (EXPO_PUBLIC_BANCO_DEMO_PORTAL_URL). */
  bancoDemoPortalUrl: string;
  /** Overrides the header name, M3's by default. */
  useDisplayName?: () => string;
}

/** Installs the module once at startup. */
export function configureInvestment(config: InvestmentConfig): void {
  if (config.useDisplayName) displayName = config.useDisplayName;
  setInvestmentDeps({
    accounts: config.accounts,
    market: createMarketApi(),
    clock: config.clock,
    // The simulator serves CDT opening at /portal/actions (docs/adr/0006-market-data.md).
    portalUrl: `${config.bancoDemoPortalUrl.replace(/\/$/, '')}/portal/actions`,
  });
}

/** Local Banco Demo simulator (docker-compose publishes its portal on 8082). */
const DEFAULT_PORTAL_URL = 'https://localhost:8082';
/** Since when the chart reads the history: everything M6 keeps ("Todo"). */
const HISTORY_FROM = '2000-01-01';

/**
 * M6: the user's CDT accounts and the daily total of their balances, for the chart. The tab
 * reloads them when a sync ends (pull to refresh on Inicio, app open) or the vault opens or closes.
 */
export const cdtAccounts: AccountsPort = {
  getCdtAccounts: () => getCdtAccounts(),
  subscribe(onChange) {
    const offs = [
      appEvents.on('sync.completed', () => onChange()),
      appEvents.on('vault.unlocked', () => onChange()),
      appEvents.on('vault.locked', () => onChange()),
    ];
    return () => offs.forEach((off) => off());
  },
  async getCdtBalanceHistory() {
    const cdts = await getCdtAccounts();
    if (cdts.length === 0) return [];
    return totalPerDay(
      await getBalanceHistory(
        cdts.map((a) => a.id),
        HISTORY_FROM,
      ),
    );
  },
};

/**
 * The module installs itself when the app loads it, like M7, M8 and M9: its CDTs come from M6
 * and "+ Invertir" opens the Banco Demo portal of EXPO_PUBLIC_BANCO_DEMO_PORTAL_URL. The header
 * greets the person with the name typed in onboarding (M3).
 */
configureInvestment({
  accounts: cdtAccounts,
  clock: { now: () => new Date() },
  bancoDemoPortalUrl: process.env.EXPO_PUBLIC_BANCO_DEMO_PORTAL_URL ?? DEFAULT_PORTAL_URL,
});
