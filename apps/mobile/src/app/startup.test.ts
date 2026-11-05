import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { createElement, type ReactNode } from 'react';

import { appEvents } from '@shared/events/appEvents';
import { VaultLockedError } from '@shared/ports';

import { ANALYTICS_QUERY_KEY, getMonthSummary, useMonthSummary } from '@modules/analytics';
import { getFixedExpensesThisMonth, getSubscriptionsSummary } from '@modules/recurring';
import { getGoalsForSnapshot, getPaydayContribution } from '@modules/savings';
import { getTransactionsBetween } from '@modules/transactions';
import { registerBackupCollection, registerVaultMigrations } from '@modules/vault';

import { analyticsSources, bindQueryClient, startModules } from './startup';

// The real vault (M2) talks to the Keychain and SQLCipher. Here modules only register with it,
// and it stays locked.
jest.mock('@modules/vault', () => ({
  routes: { module: 'vault', screens: [] },
  registerVaultMigrations: jest.fn(),
  registerBackupCollection: jest.fn(),
  markDirty: jest.fn(),
  getVaultDb: () => {
    throw new (jest.requireActual('@shared/ports').VaultLockedError)();
  },
}));

const migrationsOf = () =>
  jest.mocked(registerVaultMigrations).mock.calls.map(([module]) => module);

const collectionsOf = () =>
  jest.mocked(registerBackupCollection).mock.calls.map(([c]) => c.collection);

beforeAll(() => {
  startModules();
});

describe('app startup', () => {
  it('feeds M10 with the movements of M7, the goals of M8 and the subscriptions of M9', () => {
    expect(analyticsSources).toEqual({
      listTransactions: getTransactionsBetween,
      getSubscriptionSummary: getSubscriptionsSummary,
      getFixedExpensesMonthly: getFixedExpensesThisMonth,
      getGoalSummaries: getGoalsForSnapshot,
      getPaydayContribution,
    });
  });

  it('installs M10, so its functions and hooks work', async () => {
    // Before, this failed with "Analytics is not configured yet". Now it reaches M7's movements,
    // which wait for the vault to open.
    await expect(getMonthSummary()).rejects.toBeInstanceOf(VaultLockedError);

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client }, children);
    const { result } = await renderHook(() => useMonthSummary(), { wrapper });
    expect(result.current.unavailable).toBe(false);
    // The query runs (it is not disabled) and fails only because the vault is locked.
    await waitFor(() => expect(result.current.error).toBeInstanceOf(VaultLockedError));
  });

  it('registers the vault tables of M10 and then M11, and the caps backup collection', () => {
    const modules = migrationsOf();
    expect(modules).toContain('analytics');
    expect(modules).toContain('recommendations');
    expect(modules.indexOf('analytics')).toBeLessThan(modules.indexOf('recommendations'));
    expect(collectionsOf()).toContain('analytics.caps');
  });

  it('installs the modules only once', () => {
    startModules();
    expect(migrationsOf().filter((m) => m === 'analytics')).toHaveLength(1);
    expect(migrationsOf().filter((m) => m === 'recommendations')).toHaveLength(1);
    expect(collectionsOf().filter((c) => c === 'analytics.caps')).toHaveLength(1);
  });

  it('refreshes the cached analytics of the bound client when movements change', () => {
    const client = new QueryClient();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const unbind = bindQueryClient(client);

    appEvents.emit({ type: 'transactions.changed', ids: ['t1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ANALYTICS_QUERY_KEY });

    unbind();
    invalidate.mockClear();
    appEvents.emit({ type: 'transactions.changed', ids: ['t2'] });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
