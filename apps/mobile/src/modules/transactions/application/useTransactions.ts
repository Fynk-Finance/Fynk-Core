// Hooks of the movement lists, cached in TanStack Query under ['transactions', ...]. The cache
// never goes stale by time: it is refetched when the movements change (transactions.changed,
// sync.completed) and when the vault opens or closes. Pages are keyset pages: on a refetch
// TanStack asks each page again from the new last row, so rows never repeat or go missing.
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useEffect } from 'react';

import type { AppEvents } from '@shared/events/appEvents';
import { VaultLockedError } from '@shared/ports';

import type {
  TransactionCursor,
  TransactionFilter,
  TransactionPage,
  TransactionSummary,
} from '../domain/query';
import type { TransactionsService } from './transactionsService';

export const TRANSACTIONS_QUERY_KEY = ['transactions'] as const;

const EMPTY_PAGE: TransactionPage = { items: [], nextCursor: null };
const EMPTY_SUMMARY: TransactionSummary = { count: 0, incomeMinor: 0, spendMinor: 0 };

/** While the vault is locked the lists read as empty: the vault gate hides the tabs then. */
async function unlessLocked<T>(read: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof VaultLockedError) return empty;
    throw error;
  }
}

export interface TransactionHooksDeps {
  service: Pick<TransactionsService, 'queryTransactions' | 'summarize'>;
  events: Pick<AppEvents, 'on'>;
}

export function createTransactionHooks({ service, events }: TransactionHooksDeps) {
  /** Refetches every movement query when the movements or the vault change. */
  function useRefreshOnChanges() {
    const queryClient = useQueryClient();
    useEffect(() => {
      const refresh = () => {
        void queryClient.invalidateQueries({ queryKey: TRANSACTIONS_QUERY_KEY });
      };
      const off = [
        events.on('transactions.changed', refresh),
        events.on('sync.completed', refresh),
        events.on('vault.unlocked', refresh),
        events.on('vault.locked', refresh),
      ];
      return () => off.forEach((unsubscribe) => unsubscribe());
    }, [queryClient]);
  }

  /** Pages of `pageSize` movements, newest first. fetchNextPage() is "Cargar 20 más". */
  function useTransactionPages(filter: TransactionFilter, pageSize?: number) {
    useRefreshOnChanges();
    return useInfiniteQuery<
      TransactionPage,
      Error,
      InfiniteData<TransactionPage, TransactionCursor | null>,
      readonly unknown[],
      TransactionCursor | null
    >({
      queryKey: [...TRANSACTIONS_QUERY_KEY, 'pages', filter, pageSize ?? null],
      queryFn: ({ pageParam }) =>
        unlessLocked(
          () => service.queryTransactions(filter, { cursor: pageParam, limit: pageSize }),
          EMPTY_PAGE,
        ),
      initialPageParam: null,
      getNextPageParam: (last) => last.nextCursor,
      staleTime: Infinity,
    });
  }

  /** Count and money in and out of the filter, for the line above the list. */
  function useTransactionSummary(filter: TransactionFilter) {
    useRefreshOnChanges();
    return useQuery({
      queryKey: [...TRANSACTIONS_QUERY_KEY, 'summary', filter],
      queryFn: () => unlessLocked(() => service.summarize(filter), EMPTY_SUMMARY),
      staleTime: Infinity,
    });
  }

  return { useTransactionPages, useTransactionSummary };
}

export type TransactionHooks = ReturnType<typeof createTransactionHooks>;
