// React hooks of the Inversión tab. The ports are installed once with configureInvestment()
// (index.ts). Until then the screen shows its empty states, and the calculator still works.
import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import type { Clock } from '@shared/domain';

import type { AccountsPort, MarketPort } from './ports';

export interface InvestmentDeps {
  accounts: AccountsPort;
  market: MarketPort;
  clock: Clock;
  /** Banco Demo portal where "+ Invertir" goes (system browser). */
  portalUrl: string;
}

export const INVESTMENT_QUERY_KEY = ['investment'] as const;

let current: InvestmentDeps | null = null;
const listeners = new Set<() => void>();

export function setInvestmentDeps(deps: InvestmentDeps | null): void {
  current = deps;
  listeners.forEach((fn) => fn());
}

export function useInvestmentDeps(): InvestmentDeps | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

/** The user's own CDT accounts and their history (vault data: dropped when unused). */
export function useOwnCdts() {
  const deps = useInvestmentDeps();
  return useQuery({
    queryKey: [...INVESTMENT_QUERY_KEY, 'own'],
    queryFn: async () => {
      const d = deps as InvestmentDeps;
      const [accounts, history] = await Promise.all([
        d.accounts.getCdtAccounts(),
        d.accounts.getCdtBalanceHistory ? d.accounts.getCdtBalanceHistory() : Promise.resolve([]),
      ]);
      return { accounts, history };
    },
    enabled: deps !== null,
    gcTime: 0,
  });
}

/** Market data: the same for every user, so it may stay cached. */
export function useCdtCatalog() {
  const deps = useInvestmentDeps();
  return useQuery({
    queryKey: [...INVESTMENT_QUERY_KEY, 'catalog'],
    queryFn: () => (deps as InvestmentDeps).market.getCdtProducts(),
    enabled: deps !== null,
    staleTime: 60 * 60 * 1000,
  });
}

export function useCdtReference() {
  const deps = useInvestmentDeps();
  return useQuery({
    queryKey: [...INVESTMENT_QUERY_KEY, 'reference'],
    queryFn: () => (deps as InvestmentDeps).market.getCdtReference(),
    enabled: deps !== null,
    staleTime: 6 * 60 * 60 * 1000,
    retry: false,
  });
}

export function useQuotes(enabled: boolean) {
  const deps = useInvestmentDeps();
  return useQuery({
    queryKey: [...INVESTMENT_QUERY_KEY, 'quotes'],
    queryFn: () => (deps as InvestmentDeps).market.getQuotes(),
    enabled: deps !== null && enabled,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });
}
