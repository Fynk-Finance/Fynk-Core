// Module registry (owned by M0). Created once with all 14 modules: nobody adds lines later
// (CLAUDE.md, Conflict rules). A module changes its screens in its own index.ts `routes`.
import { routes as accounts } from '@modules/accounts';
import { routes as analytics } from '@modules/analytics';
import { routes as bank } from '@modules/bank';
import { routes as compliance } from '@modules/compliance';
import { routes as consents } from '@modules/consents';
import { routes as identity } from '@modules/identity';
import { routes as investment } from '@modules/investment';
import { routes as notifications } from '@modules/notifications';
import { routes as onboarding } from '@modules/onboarding';
import { routes as recommendations } from '@modules/recommendations';
import { routes as recurring } from '@modules/recurring';
import { routes as savings } from '@modules/savings';
import { routes as transactions } from '@modules/transactions';
import { routes as vault } from '@modules/vault';
import type { ModuleName } from '@shared/domain/types';
import type { ModuleRoutes, ModuleScreen, TabName } from '@shared/navigation';

export const moduleRoutes: Record<ModuleName, ModuleRoutes> = {
  identity,
  vault,
  onboarding,
  consents,
  bank,
  accounts,
  transactions,
  savings,
  recurring,
  analytics,
  recommendations,
  notifications,
  compliance,
  investment,
};

/** Which module builds the root screen of each tab (screen inventory of docs/design/README.md). */
export const tabOwners: Record<TabName, ModuleName> = {
  Dashboard: 'accounts', // M6, with sections from M7, M8 and M10
  Billetera: 'recurring', // M9, with "Mis cuentas" from M6
  Recomendaciones: 'recommendations', // M11
  Inversion: 'investment', // M15
};

export const tabOrder: TabName[] = ['Dashboard', 'Billetera', 'Recomendaciones', 'Inversion'];

/**
 * Full-screen flows shown before the tabs, in this order: sign in (M1), unlock the vault (M2),
 * finish onboarding (M3). The first module whose gate returns true wins.
 */
export const gateOrder: ModuleName[] = ['identity', 'vault', 'onboarding'];

/** Every pushed screen of every module, checked for unique `<module>.<Screen>` names. */
export function collectScreens(
  routes: Record<ModuleName, ModuleRoutes> = moduleRoutes,
): ModuleScreen[] {
  const seen = new Set<string>();
  const screens: ModuleScreen[] = [];
  for (const [module, r] of Object.entries(routes) as [ModuleName, ModuleRoutes][]) {
    if (r.module !== module) {
      throw new Error(`Module "${module}" exports routes of "${r.module}"`);
    }
    for (const screen of r.screens ?? []) {
      if (!screen.name.startsWith(`${module}.`)) {
        throw new Error(`Screen "${screen.name}" of ${module} must be named "${module}.<Screen>"`);
      }
      if (seen.has(screen.name)) throw new Error(`Screen "${screen.name}" is declared twice`);
      seen.add(screen.name);
      screens.push(screen);
    }
  }
  return screens;
}
