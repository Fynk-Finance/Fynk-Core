// Deep links (owned by M0). Scheme fynk://. Each module owns one path prefix, reserved here once,
// and declares its screen paths under it in its own `routes` (CLAUDE.md, Conflict rules).
// Notifications use these links (NotifyInput.deepLink), e.g. fynk://billetera/recurrentes/<id>.
import type { LinkingOptions, ParamListBase } from '@react-navigation/native';

import type { ModuleName } from '@shared/domain/types';
import type { ModuleRoutes, TabName } from '@shared/navigation';

import { collectScreens, moduleRoutes, tabOwners } from './registry';

export const SCHEME = 'fynk';

/** fynk://<prefix>/... belongs to the module. */
export const deepLinkPrefixes: Record<ModuleName, string> = {
  identity: 'cuenta', // Mi cuenta, devices
  vault: 'boveda', // unlock, recovery code, device approval
  onboarding: 'configuracion',
  consents: 'consentimientos',
  bank: 'bank', // fynk://bank/callback is the bank OAuth return (M5, M16)
  accounts: 'cuentas',
  transactions: 'movimientos',
  savings: 'metas',
  recurring: 'billetera',
  analytics: 'analisis',
  recommendations: 'recomendaciones',
  notifications: 'notificaciones',
  compliance: 'privacidad',
  investment: 'inversion',
};

/** Path of each tab root. The tab's owner module holds the same prefix. */
export const tabPaths: Record<TabName, string> = {
  Dashboard: 'dashboard',
  Billetera: deepLinkPrefixes[tabOwners.Billetera],
  Recomendaciones: deepLinkPrefixes[tabOwners.Recomendaciones],
  Inversion: deepLinkPrefixes[tabOwners.Inversion],
};

/** Throws when a module declares a path outside its own prefix. */
export function checkScreenPaths(routes: Record<ModuleName, ModuleRoutes> = moduleRoutes): void {
  for (const [module, r] of Object.entries(routes) as [ModuleName, ModuleRoutes][]) {
    const prefix = deepLinkPrefixes[module];
    for (const screen of r.screens ?? []) {
      if (screen.path === undefined) continue;
      if (screen.path !== prefix && !screen.path.startsWith(`${prefix}/`)) {
        throw new Error(`Path "${screen.path}" of ${screen.name} must start with "${prefix}"`);
      }
    }
  }
}

export function buildLinking(
  routes: Record<ModuleName, ModuleRoutes> = moduleRoutes,
): LinkingOptions<ParamListBase> {
  checkScreenPaths(routes);
  const screens: Record<string, unknown> = {
    Main: { screens: { ...tabPaths } },
  };
  for (const screen of collectScreens(routes)) {
    if (screen.path !== undefined) screens[screen.name] = screen.path;
  }
  // Nested tab screens are not typed by PathConfigMap<ParamListBase>, so cast once here.
  type Screens = NonNullable<LinkingOptions<ParamListBase>['config']>['screens'];
  return { prefixes: [`${SCHEME}://`], config: { screens: screens as Screens } };
}
