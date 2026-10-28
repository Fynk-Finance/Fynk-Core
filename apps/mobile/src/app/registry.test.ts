import { MODULE_NAMES, type ModuleName } from '@shared/domain/types';
import type { ModuleRoutes } from '@shared/navigation';

import { collectScreens, gateOrder, moduleRoutes, tabOrder, tabOwners } from './registry';

const Dummy = () => null;

describe('module registry', () => {
  it('lists all 14 modules, each exporting its own routes', () => {
    expect(Object.keys(moduleRoutes).sort()).toEqual([...MODULE_NAMES].sort());
    for (const [module, routes] of Object.entries(moduleRoutes)) {
      expect(routes.module).toBe(module);
    }
  });

  it('gives every module a placeholder: a tab, a flow or a screen', () => {
    for (const routes of Object.values(moduleRoutes)) {
      const count = (routes.tab ? 1 : 0) + (routes.flow ? 1 : 0) + (routes.screens?.length ?? 0);
      expect(count).toBeGreaterThan(0);
    }
  });

  it('has the four tabs of the design, each provided by its owner', () => {
    expect(tabOrder).toEqual(['Dashboard', 'Billetera', 'Recomendaciones', 'Inversion']);
    for (const tab of tabOrder) {
      expect(moduleRoutes[tabOwners[tab]].tab).toBeDefined();
    }
  });

  // Gates are React hooks (M1's reads the session), so they are only called while rendering:
  // see AppRoot.test.tsx.
  it('runs the sign in, unlock and onboarding gates in that order, each with its flow', () => {
    expect(gateOrder).toEqual(['identity', 'vault', 'onboarding']);
    for (const module of gateOrder) {
      expect(moduleRoutes[module].flow).toBeDefined();
      expect(typeof moduleRoutes[module].useGate).toBe('function');
    }
  });

  it('collects every screen once', () => {
    const names = collectScreens().map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('notifications.Inbox');
  });

  describe('collectScreens rejects', () => {
    const base = moduleRoutes;
    const withRoutes = (module: ModuleName, routes: Partial<ModuleRoutes>) => ({
      ...base,
      [module]: { module, ...routes },
    });

    it('a screen not named after its module', () => {
      const routes = withRoutes('savings', {
        screens: [{ name: 'recurring.Goals', component: Dummy }],
      });
      expect(() => collectScreens(routes)).toThrow('must be named "savings.<Screen>"');
    });

    it('the same screen name twice', () => {
      const routes = withRoutes('savings', {
        screens: [
          { name: 'savings.Goals', component: Dummy },
          { name: 'savings.Goals', component: Dummy },
        ],
      });
      expect(() => collectScreens(routes)).toThrow('declared twice');
    });

    it('routes exported under another module name', () => {
      const routes = { ...base, savings: { module: 'recurring' as const } };
      expect(() => collectScreens(routes)).toThrow('exports routes of "recurring"');
    });
  });
});
