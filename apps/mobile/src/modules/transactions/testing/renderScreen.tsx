// Renders M7 screens inside the providers of the app (theme, query client, a stack navigator),
// and builds the service on a node:sqlite vault. Test-only: never import it from app code.
import { NavigationContainer, useRoute } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Text } from 'react-native';

import type { Transaction } from '@shared/domain/types';
import { createAppEvents } from '@shared/events/appEvents';
import { createFixedClock } from '@shared/testing';
import { ThemeProvider, type ThemePreference } from '@shared/ui';

import { transactionsMigrations } from '../adapters/vault/migrations';
import { createVaultCategoryStore } from '../adapters/vault/vaultCategoryStore';
import { createVaultManualStore } from '../adapters/vault/vaultManualStore';
import { createVaultTransactionsStore } from '../adapters/vault/vaultTransactionsStore';
import { createCategoryService } from '../application/categoryService';
import { createManualService } from '../application/manualService';
import { createTransactionsService } from '../application/transactionsService';
import { createTransactionHooks } from '../application/useTransactions';
import { createNodeSqliteVault } from './nodeSqliteVault';

const Stack = createNativeStackNavigator();
const noStore = { load: async () => 'system' as const, save: async () => undefined };

/** A stand-in for another screen: prints its route name and params. */
export function RouteProbe() {
  const route = useRoute();
  return <Text testID="probe.route">{`${route.name} ${JSON.stringify(route.params ?? {})}`}</Text>;
}

/** Services, hooks and events of M7 on an empty test vault, plus a way to seed bank movements. */
export async function createTestModule() {
  const vault = createNodeSqliteVault();
  vault.registerMigrations('transactions', transactionsMigrations);
  await vault.migrate();
  const events = createAppEvents();
  const service = createTransactionsService({
    store: () => createVaultTransactionsStore(vault.db),
    events,
    treatsThreshold: async () => 2_000_000,
  });
  let ids = 0;
  const categories = createCategoryService({
    store: () => createVaultTransactionsStore(vault.db),
    categories: () => createVaultCategoryStore(vault.db),
    events,
    clock: createFixedClock('2026-09-21T15:00:00Z'),
    newId: () => `change-${++ids}`,
    markDirty: jest.fn(),
  });
  const manual = createManualService({
    store: () => createVaultTransactionsStore(vault.db),
    manual: () => createVaultManualStore(vault.db),
    events,
    // M6's balances: tested in M6 and in manualService.test.ts.
    balances: { apply: async () => undefined },
    newId: () => `manual-${++ids}`,
    markDirty: jest.fn(),
    treatsThreshold: async () => 2_000_000,
  });
  const hooks = createTransactionHooks({
    service,
    history: (id) => categories.getCategoryHistory(id),
    events,
  });
  const seed = async (txs: Transaction[]) => {
    const byAccount = new Map<string, Transaction[]>();
    for (const tx of txs) byAccount.set(tx.accountId, [...(byAccount.get(tx.accountId) ?? []), tx]);
    for (const [accountId, transactions] of byAccount) {
      await service.upsertFromSync({ accountId, since: '2020-01-01T00:00:00Z', transactions });
    }
  };
  return { vault, events, service, categories, manual, hooks, seed };
}

export interface RenderOptions {
  screens: Record<string, ComponentType>;
  initial: string;
  initialParams?: object;
  preference?: ThemePreference;
}

export async function renderScreens({
  screens,
  initial,
  initialParams,
  preference,
}: RenderOptions) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  await render(
    <ThemeProvider initialPreference={preference ?? 'light'} store={noStore}>
      <QueryClientProvider client={client}>
        <NavigationContainer>
          <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
            {Object.entries(screens).map(([name, component]) => (
              <Stack.Screen
                key={name}
                name={name}
                component={component}
                initialParams={name === initial ? initialParams : undefined}
              />
            ))}
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </ThemeProvider>,
  );
  return { client };
}
