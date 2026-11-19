import { useMutation, useQueryClient } from '@tanstack/react-query';

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

// The keys live as long as the app run, not as long as a screen: the acceptance screen is
// closed while the bank's page is open, and a retry after it must not record a second consent.
const keysOf = new WeakMap<ConsentsDeps, Map<string, string>>();

/**
 * `createConsent` for a screen. One Idempotency-Key per provider and text version, so a double
 * tap, a retry after a lost answer or a new try after a cancelled bank page returns the same
 * pending consent. A key whose consent is no longer pending (it was linked, revoked or it
 * failed) is dropped, because the next acceptance is a new consent. When the text changed
 * since it was shown, the text is loaded again and the person has to accept the new one.
 */
export function useCreateConsent(deps: ConsentsDeps) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: Omit<CreateConsentInput, 'idempotencyKey'>) => {
      let keys = keysOf.get(deps);
      if (!keys) keysOf.set(deps, (keys = new Map()));
      const target = `${input.provider.id}|${input.text.version}|${input.text.sha256}`;
      const known = keys.get(target);
      if (known) {
        const consent = await createConsent(deps, { ...input, idempotencyKey: known });
        if (consent.status === 'pending') return consent;
      }
      const key = deps.newIdempotencyKey();
      keys.set(target, key);
      return createConsent(deps, { ...input, idempotencyKey: key });
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
