// React hooks of Recomendaciones. The service is installed once with configureRecommendations()
// (index.ts); until then the screen shows its empty state.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import type { RecommendationsService, RecommendationsView } from './recommendationsService';

export const RECOMMENDATIONS_QUERY_KEY = ['recommendations'] as const;

let current: RecommendationsService | null = null;
const listeners = new Set<() => void>();

export function setRecommendationsService(service: RecommendationsService | null): void {
  current = service;
  listeners.forEach((fn) => fn());
}

export function getRecommendationsService(): RecommendationsService | null {
  return current;
}

export function useRecommendationsService(): RecommendationsService | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => current,
  );
}

/**
 * The view: first the cached one (no network), then the refreshed one. Refresh asks the model
 * only when the numbers changed and the last call is an hour old.
 */
export function useRecommendations() {
  const service = useRecommendationsService();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'view'],
    queryFn: async (): Promise<RecommendationsView> => {
      const s = service as RecommendationsService;
      const cached = await s.load();
      // Show the cached view at once, then replace it with the refreshed one.
      client.setQueryData([...RECOMMENDATIONS_QUERY_KEY, 'view'], cached);
      return s.refresh();
    },
    enabled: service !== null,
    gcTime: 0,
  });
  const refresh = useMutation({
    mutationFn: () => (service as RecommendationsService).refresh(),
    onSuccess: (view) => client.setQueryData([...RECOMMENDATIONS_QUERY_KEY, 'view'], view),
  });
  return { query, refresh, unavailable: service === null };
}

/** "Recomendaciones con IA" switch, for M13's Privacidad y datos screen. */
export function useAiRecommendationsSetting() {
  const service = useRecommendationsService();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: [...RECOMMENDATIONS_QUERY_KEY, 'aiEnabled'],
    queryFn: () => (service as RecommendationsService).isAiEnabled(),
    enabled: service !== null,
  });
  const set = useMutation({
    mutationFn: (enabled: boolean) => (service as RecommendationsService).setAiEnabled(enabled),
    onSuccess: () => client.invalidateQueries({ queryKey: RECOMMENDATIONS_QUERY_KEY }),
  });
  return {
    enabled: query.data ?? true,
    set: (v: boolean) => set.mutate(v),
    pending: set.isPending,
  };
}
