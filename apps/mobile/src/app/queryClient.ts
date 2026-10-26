import { QueryClient } from '@tanstack/react-query';

// TanStack Query for server state. Nothing refetches in the background: data refreshes only
// when the app opens, on pull to refresh or on return to the foreground (CLAUDE.md, rule 4),
// which the sync engine (M5) decides.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: false,
      },
      mutations: { retry: 0 },
    },
  });
}
