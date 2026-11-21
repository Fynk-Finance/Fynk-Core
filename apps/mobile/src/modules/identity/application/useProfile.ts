import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { isApiError } from '@shared/api';

import type { ProfilePort } from './ports';

export const PROFILE_QUERY_KEY = ['identity', 'profile'] as const;

const isAccountGone = (e: unknown): boolean => isApiError(e) && e.code === 'profile_not_found';

/**
 * The person's profile. When the API says the account no longer exists (`profile_not_found`)
 * `onAccountGone` runs once (the screen signs out). Other errors stay in the query for a retry.
 */
export function useProfile(port: ProfilePort, onAccountGone: () => void) {
  const query = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: () => port.getProfile(),
    // A missing account will not come back; do not retry it.
    retry: (failures, error) => !isAccountGone(error) && failures < 1,
    // Dropped as soon as no screen shows it, so a sign out never leaves this person's profile in
    // the cache for the next account that signs in on this phone.
    gcTime: 0,
  });

  const gone = isAccountGone(query.error);
  const notified = useRef(false);
  const callback = useRef(onAccountGone);
  useEffect(() => {
    callback.current = onAccountGone;
  });
  useEffect(() => {
    if (gone && !notified.current) {
      notified.current = true;
      callback.current();
    }
  }, [gone]);

  return query;
}
