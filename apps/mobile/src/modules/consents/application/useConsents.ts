import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Consent } from '../domain/consent';
import type { ConsentsApiPort } from './ports';
import type { Revocation } from './revocation';

export const CONSENTS_QUERY_KEY = ['consents', 'list'] as const;
export const consentQueryKey = (id: string) => ['consents', 'detail', id] as const;
export const ENTITY_NAMES_QUERY_KEY = ['consents', 'entityNames'] as const;

// A person's consents leave the cache as soon as no screen shows them, so another account
// signing in on this phone never sees them (the same rule as M1's profile).
const PERSONAL = { gcTime: 0 } as const;

/** Every consent of the person, fetched again each time a screen shows it (HU-007). */
export function useConsents(api: ConsentsApiPort) {
  return useQuery({
    queryKey: CONSENTS_QUERY_KEY,
    queryFn: () => api.list(),
    refetchOnMount: 'always',
    retry: 1,
    ...PERSONAL,
  });
}

export function useConsent(api: ConsentsApiPort, id: string) {
  return useQuery({
    queryKey: consentQueryKey(id),
    queryFn: () => api.get(id),
    refetchOnMount: 'always',
    retry: 1,
    ...PERSONAL,
  });
}

/** Entity names by provider id. The same for everyone. */
export function useEntityNames(api: ConsentsApiPort) {
  return useQuery({ queryKey: ENTITY_NAMES_QUERY_KEY, queryFn: () => api.entityNames(), retry: 1 });
}

/** Revokes, then shows the new status everywhere at once (HU-007 "información actualizada"). */
export function useRevokeConsent(revocation: Revocation) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => revocation.revokeConsent(id),
    onSuccess: async (consent: Consent) => {
      // A read that started before the revocation must not land after it with the old status.
      await client.cancelQueries({ queryKey: consentQueryKey(consent.id) });
      await client.cancelQueries({ queryKey: CONSENTS_QUERY_KEY });
      client.setQueryData(consentQueryKey(consent.id), consent);
      client.setQueryData<Consent[]>(CONSENTS_QUERY_KEY, (list) =>
        list?.map((c) => (c.id === consent.id ? consent : c)),
      );
      void client.invalidateQueries({ queryKey: CONSENTS_QUERY_KEY });
    },
  });
}
