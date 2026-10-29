import { useQuery } from '@tanstack/react-query';

import type { ConsentsApiPort } from './ports';

export const CONSENT_TEXT_QUERY_KEY = ['consents', 'text'] as const;

/** The published consent text. It is the same for everyone and holds no personal data. */
export function useConsentText(api: ConsentsApiPort) {
  return useQuery({
    queryKey: CONSENT_TEXT_QUERY_KEY,
    queryFn: () => api.currentText(),
    retry: 1,
  });
}
