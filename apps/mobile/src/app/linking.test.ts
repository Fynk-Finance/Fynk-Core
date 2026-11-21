import { getStateFromPath } from '@react-navigation/native';

import { MODULE_NAMES } from '@shared/domain/types';

import { buildLinking, checkScreenPaths, deepLinkPrefixes, SCHEME, tabPaths } from './linking';
import { moduleRoutes } from './registry';

const Dummy = () => null;

function routeNames(path: string): string[] {
  const linking = buildLinking();
  const state = getStateFromPath(path, linking.config);
  const names: string[] = [];
  let current = state as { routes: { name: string; state?: unknown }[] } | undefined;
  while (current) {
    const route = current.routes[current.routes.length - 1];
    if (!route) break;
    names.push(route.name);
    current = route.state as typeof current;
  }
  return names;
}

describe('deep links', () => {
  it('use the fynk:// scheme', () => {
    expect(SCHEME).toBe('fynk');
    expect(buildLinking().prefixes).toEqual(['fynk://']);
  });

  it('reserve one unique prefix for each of the 14 modules', () => {
    expect(Object.keys(deepLinkPrefixes).sort()).toEqual([...MODULE_NAMES].sort());
    const prefixes = Object.values(deepLinkPrefixes);
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it('keep the prefixes the other modules already use', () => {
    expect(deepLinkPrefixes.recurring).toBe('billetera'); // fynk://billetera/recurrentes/<id> (M9, M12)
    expect(deepLinkPrefixes.savings).toBe('metas'); // fynk://metas/... (M8)
    expect(deepLinkPrefixes.bank).toBe('bank'); // fynk://bank/callback (M5, M16)
  });

  it('open each tab by its path', () => {
    expect(tabPaths).toEqual({
      Dashboard: 'dashboard',
      Billetera: 'billetera',
      Recomendaciones: 'recomendaciones',
      Inversion: 'inversion',
    });
    expect(routeNames('billetera')).toEqual(['Main', 'Billetera']);
    expect(routeNames('inversion')).toEqual(['Main', 'Inversion']);
  });

  it('open a module screen by its path', () => {
    expect(routeNames('notificaciones')).toEqual(['notifications.Inbox']);
    expect(routeNames('metas')).toEqual(['savings.Goals']);
  });

  it('reject a module path outside its prefix', () => {
    const routes = {
      ...moduleRoutes,
      savings: {
        module: 'savings' as const,
        screens: [{ name: 'savings.Goals' as const, component: Dummy, path: 'billetera/metas' }],
      },
    };
    expect(() => checkScreenPaths(routes)).toThrow('must start with "metas"');
    expect(() => checkScreenPaths()).not.toThrow();
  });
});
