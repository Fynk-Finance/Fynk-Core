// Public API of the investment module (M15). Other modules import only from this file.
import type { Clock } from '@shared/domain';
import type { ModuleRoutes } from '@shared/navigation';

import { createMarketApi } from './adapters/api/marketApi';
import { setInvestmentDeps } from './application/hooks';
import type { AccountsPort } from './application/ports';
import { createInvestmentScreen } from './ui/InvestmentScreen';

export type { AccountsPort };

let displayName: () => string = () => 'Invitado';

export const routes: ModuleRoutes = {
  module: 'investment',
  tab: createInvestmentScreen(() => displayName()),
};

export interface InvestmentConfig {
  accounts: AccountsPort; // M6 getCdtAccounts()
  clock: Clock;
  /** Banco Demo portal base, e.g. https://bancodemo.fynk.co (EXPO_PUBLIC_BANCO_DEMO_PORTAL_URL). */
  bancoDemoPortalUrl: string;
  /** Header name (M1). Optional. */
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
