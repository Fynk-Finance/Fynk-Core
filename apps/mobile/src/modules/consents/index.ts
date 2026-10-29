// Public API of the consents module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

import { appVersion, newIdempotencyKey } from './adapters/appInfo';
import { createConsentsApi } from './adapters/consentsApi';
import {
  createConsent as createConsentWith,
  type CreateConsentInput,
} from './application/createConsent';
import type { ConsentsDeps } from './application/ports';
import { useConsentText as useConsentTextWith } from './application/useConsentText';

export type {
  Consent,
  ConsentProvider,
  ConsentScope,
  ConsentStatus,
  ConsentText,
} from './domain/consent';
export { scopesOf } from './domain/consent';
export type { CreateConsentInput } from './application/createConsent';

const deps: ConsentsDeps = { api: createConsentsApi(), appVersion, newIdempotencyKey };

/** The published consent text, purpose and term (React Query). */
export const useConsentText = () => useConsentTextWith(deps.api);

/** Records the acceptance of exactly what was shown as a pending consent. */
export const createConsent = (input: CreateConsentInput) => createConsentWith(deps, input);

// Placeholder routes from M0 (M4 replaces them with the real screens).
export const routes: ModuleRoutes = {
  module: 'consents',
  screens: [
    {
      name: 'consents.List',
      component: createPlaceholderScreen({
        title: 'Consentimientos',
        owner: 'M4 · Consentimientos',
      }),
      path: 'consentimientos',
    },
  ],
};
