import { useQuery } from '@tanstack/react-query';

import type { ProvidersPort } from './ports';

export const PROVIDERS_QUERY_KEY = ['bank', 'providers'] as const;

/** Entities the person can connect. The list is the same for everyone and holds no personal data. */
export function useProviders(port: ProvidersPort) {
  return useQuery({ queryKey: PROVIDERS_QUERY_KEY, queryFn: () => port.list(), retry: 1 });
}
