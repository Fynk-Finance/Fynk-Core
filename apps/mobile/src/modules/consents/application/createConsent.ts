import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { isApiError } from '@shared/api';

import {
  buildConsentRequest,
  consentErrorKind,
  type Consent,
  type ConsentErrorKind,
  type ConsentProvider,
  type ConsentText,
} from '../domain/consent';
import type { ConsentsDeps } from './ports';
import { CONSENT_TEXT_QUERY_KEY } from './useConsentText';

export interface CreateConsentInput {
  provider: ConsentProvider;
  /** The text the screen showed. Its version and hash are the acceptance evidence. */
  text: ConsentText;
  /** Reuse the key of a failed try, so a retry never records a second consent. */
  idempotencyKey?: string;
}

/** Records the acceptance of exactly what was shown as a pending consent (HU-006). */
export function createConsent(deps: ConsentsDeps, input: CreateConsentInput): Promise<Consent> {
  const request = buildConsentRequest({
    provider: input.provider,
    text: input.text,
    appVersion: deps.appVersion,
  });
  return deps.api.create(request, input.idempotencyKey ?? deps.newIdempotencyKey());
}

export const errorKindOf = (e: unknown): ConsentErrorKind =>
  consentErrorKind(isApiError(e) ? e.code : undefined);

/**
 * `createConsent` for a screen. One Idempotency-Key per provider and text version, so a double
 * tap or a retry after a lost answer returns the same pending consent. When the text changed
 * since it was shown, the text is loaded again and the person has to accept the new one.
 */
export function useCreateConsent(deps: ConsentsDeps) {
  const queryClient = useQueryClient();
  const key = useRef<{ for: string; value: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (input: Omit<CreateConsentInput, 'idempotencyKey'>) => {
      const target = `${input.provider.id}|${input.text.version}|${input.text.sha256}`;
      if (key.current?.for !== target)
        key.current = { for: target, value: deps.newIdempotencyKey() };
      return createConsent(deps, { ...input, idempotencyKey: key.current.value });
    },
    onError: (e) => {
      if (errorKindOf(e) === 'text_changed') {
        void queryClient.invalidateQueries({ queryKey: CONSENT_TEXT_QUERY_KEY });
      }
    },
  });

  return {
    submit: mutation.mutateAsync,
    isPending: mutation.isPending,
    errorKind: mutation.isError ? errorKindOf(mutation.error) : null,
    reset: mutation.reset,
  };
}
