import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { Account } from '@shared/domain/types';
import { VaultLockedError } from '@shared/ports';
import { createFixedClock } from '@shared/testing';

import { cash, savings, wallet } from '../testing/fixtures';
import { createAccountsService } from './accountsService';
import type { AccountsStore } from './ports';
import { createUseAccounts } from './useAccounts';

const clients: QueryClient[] = [];
afterEach(() => {
  for (const c of clients.splice(0)) c.clear();
});

function setup(initial: Account[]) {
  let accounts = initial;
  let locked = false;
  const store: AccountsStore = {
    list: async () => {
      if (locked) throw new VaultLockedError();
      return accounts;
    },
    saveSynced: async (next) => {
      accounts = [...accounts, ...next];
    },
    revokeLink: async () => undefined,
    balanceHistory: async () => [],
  };
  const service = createAccountsService({
    store: () => store,
    clock: createFixedClock('2026-10-28T15:00:00Z'),
  });
  // No garbage collection timer, so Jest exits cleanly.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const useAccounts = createUseAccounts(service);
  return { service, wrapper, useAccounts, lock: () => (locked = true) };
}

describe('useAccounts', () => {
  it('reads the accounts and their totals', async () => {
    const { wrapper, useAccounts } = setup([savings, cash]);
    const { result } = await renderHook(() => useAccounts(), { wrapper });
    await waitFor(() =>
      expect(result.current.data).toEqual({
        accounts: [savings, cash],
        balanceTotalMinor: 380_000_000,
        connectedCount: 1,
      }),
    );
  });

  it('reloads after a sync writes new accounts', async () => {
    const { service, wrapper, useAccounts } = setup([savings]);
    const { result } = await renderHook(() => useAccounts(), { wrapper });
    await waitFor(() => expect(result.current.data?.connectedCount).toBe(1));

    await act(() => service.upsertFromSync([wallet]));
    await waitFor(() => expect(result.current.data?.connectedCount).toBe(2));
  });

  it('reads as empty once the vault is locked', async () => {
    const { service, wrapper, useAccounts, lock } = setup([savings]);
    const { result } = await renderHook(() => useAccounts(), { wrapper });
    await waitFor(() => expect(result.current.data?.accounts).toHaveLength(1));

    lock();
    await act(async () => service.notifyChanged());
    await waitFor(() => expect(result.current.data?.accounts).toEqual([]));
  });
});
