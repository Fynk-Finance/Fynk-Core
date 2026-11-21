// The name typed in the Nombre step, for the greetings of other modules (the Dashboard header).
// It lives in M1's profile (GET /me), never in the vault. The cache key carries the account id,
// so the name of one account never shows for the next account that signs in on this phone.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { joinName, type PersonName } from '../domain/name';
import type { NamePort } from './ports';

export const displayNameQueryKey = (userId: string | null) =>
  ['onboarding', 'displayName', userId] as const;

export interface DisplayName {
  /** The full name ("Laura Gómez"), or null while it loads, when there is none, or on error. */
  useDisplayName: () => string | null;
  /** Puts a name just saved in the cache, so the greeting shows it before the profile answers. */
  useRememberName: () => (name: PersonName) => void;
}

export function createDisplayName(names: NamePort, userId: () => string | null): DisplayName {
  return {
    useDisplayName() {
      const id = userId();
      const query = useQuery({
        queryKey: displayNameQueryKey(id),
        queryFn: async () => joinName(await names.getName()) || null,
        enabled: id !== null,
      });
      return query.data ?? null;
    },

    useRememberName() {
      const client = useQueryClient();
      return useCallback(
        (name: PersonName) => {
          client.setQueryData(displayNameQueryKey(userId()), joinName(name) || null);
        },
        [client],
      );
    },
  };
}
