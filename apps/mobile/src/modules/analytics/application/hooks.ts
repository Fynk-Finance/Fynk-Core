// React hooks of the analytics module. The service is installed once at startup with
// configureAnalytics() (index.ts). Until then the hooks report `unavailable`, and screens show
// their empty state instead of failing. Results are cached by TanStack Query and invalidated on
// sync.completed, transactions.changed and vault.unlocked (events.ts).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import type { CategoryId, IsoDate, MoneyMinor } from '@shared/domain';

import type { CapPeriod } from '../domain/types';
import type { AnalyticsService, CapInput } from './analyticsService';

export const ANALYTICS_QUERY_KEY = ['analytics'] as const;

let current: AnalyticsService | null = null;
const listeners = new Set<() => void>();

export function setAnalyticsService(service: AnalyticsService | null): void {
  current = service;
  listeners.forEach((fn) => fn());
}

export function getAnalyticsService(): AnalyticsService | null {
  return current;
}

export function useAnalyticsService(): AnalyticsService | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

function useAnalyticsQuery<T>(key: readonly unknown[], run: (s: AnalyticsService) => Promise<T>) {
  const service = useAnalyticsService();
  const query = useQuery({
    queryKey: [...ANALYTICS_QUERY_KEY, ...key],
    queryFn: () => run(service as AnalyticsService),
    enabled: service !== null,
    // Money data: dropped as soon as no screen shows it.
    gcTime: 0,
  });
  return { ...query, unavailable: service === null };
}

export function useMonthSummary(month?: string) {
  return useAnalyticsQuery(['month', month ?? 'current'], (s) => s.getMonthSummary(month));
}

export function useSpendByCategory(range: { from: IsoDate; to: IsoDate } | null) {
  const service = useAnalyticsService();
  const query = useQuery({
    queryKey: [...ANALYTICS_QUERY_KEY, 'byCategory', range?.from, range?.to],
    queryFn: () => (service as AnalyticsService).getSpendByCategory(range!.from, range!.to),
    enabled: service !== null && range !== null,
    gcTime: 0,
  });
  return { ...query, unavailable: service === null };
}

export function useTrend(categoryId: CategoryId | 'all', months: number) {
  return useAnalyticsQuery(['trend', categoryId, months], (s) => s.getTrend(categoryId, months));
}

export function useRecurringIncome() {
  return useAnalyticsQuery(['recurringIncome'], (s) => s.getRecurringIncome());
}

export function useAnalyticsReport() {
  return useAnalyticsQuery(['report'], (s) => s.getReport());
}

export function useCapStatuses() {
  return useAnalyticsQuery(['caps'], (s) => s.listCapStatuses());
}

export function useCap(id: string | undefined) {
  return useAnalyticsQuery(['cap', id ?? 'new'], async (s) => (id ? s.getCap(id) : null));
}

export function useSuggestedCap(categoryId: CategoryId | null, period: CapPeriod) {
  return useAnalyticsQuery(['suggestedCap', categoryId, period], async (s) =>
    categoryId ? s.suggestedCap(categoryId, period) : null,
  );
}

export function useTreatsThreshold() {
  return useAnalyticsQuery(['treatsThreshold'], (s) => s.getTreatsThreshold());
}

/** Save, delete and threshold changes; every one refreshes all cached analytics. */
export function useCapMutations() {
  const service = useAnalyticsService();
  const client = useQueryClient();
  const invalidate = () => client.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEY });
  const need = () => {
    if (!service) throw new Error('Analytics is not configured');
    return service;
  };
  const save = useMutation({
    mutationFn: (input: CapInput & { treatsThresholdMinor?: MoneyMinor }) =>
      (async () => {
        const s = need();
        if (input.treatsThresholdMinor !== undefined) {
          await s.setTreatsThreshold(input.treatsThresholdMinor);
        }
        return s.saveCap(input);
      })(),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => need().deleteCap(id),
    onSuccess: invalidate,
  });
  return { save, remove };
}
