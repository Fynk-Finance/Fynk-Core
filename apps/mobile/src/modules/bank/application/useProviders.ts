import { useQuery } from '@tanstack/react-query';

import { visibleProviders } from '../domain/provider';

import type { ProvidersPort } from './ports';

export const PROVIDERS_QUERY_KEY = ['bank', 'providers'] as const;

/**
 * Entities the person can connect: every real provider plus the simulated entities where the
 * person has accounts. If the simulated list fails, every simulated entity is shown instead.
 */
export function useProviders(port: ProvidersPort) {
  return useQuery({
    queryKey: PROVIDERS_QUERY_KEY,
    queryFn: async () => {
      const [all, mine] = await Promise.all([
        port.list(),
        port.simulatedEntities().catch(() => null),
      ]);
      return visibleProviders(all, mine);
    },
    retry: 1,
  });
}
