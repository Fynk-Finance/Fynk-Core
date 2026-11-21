// useAccounts(): the active accounts and their totals, cached in TanStack Query under
// ['accounts']. The cache never goes stale by time: it is refetched only when the service says
// the accounts changed (a write, sync.completed, vault.unlocked or vault.locked).
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { VaultLockedError } from '@shared/ports';

import { EMPTY_OVERVIEW, type AccountsOverview, type AccountsService } from './accountsService';

export const ACCOUNTS_QUERY_KEY = ['accounts'] as const;

/** While the vault is locked the accounts read as empty: the vault gate hides the tabs then. */
export async function loadOverview(service: AccountsService): Promise<AccountsOverview> {
  try {
    return await service.getOverview();
  } catch (error) {
    if (error instanceof VaultLockedError) return EMPTY_OVERVIEW;
    throw error;
  }
}

export function createUseAccounts(service: AccountsService) {
  return function useAccounts() {
    const queryClient = useQueryClient();

    useEffect(
      () =>
        service.subscribe(() => {
          void queryClient.invalidateQueries({ queryKey: ACCOUNTS_QUERY_KEY });
        }),
      [queryClient],
    );

    return useQuery({
      queryKey: ACCOUNTS_QUERY_KEY,
      queryFn: () => loadOverview(service),
      staleTime: Infinity,
    });
  };
}
