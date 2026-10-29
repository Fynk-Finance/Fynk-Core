// Public API of the consents module. Other modules import only from this file.
import { createPlaceholderScreen, type ModuleRoutes } from '@shared/navigation';

import { appVersion, newIdempotencyKey } from './adapters/appInfo';
import { createConsentsApi } from './adapters/consentsApi';
import { systemClock } from './adapters/systemClock';
import {
  createConsent as createConsentWith,
  type CreateConsentInput,
} from './application/createConsent';
import type { ConsentsDeps } from './application/ports';
import { createRevocation } from './application/revocation';
import { useConsents as useConsentsWith } from './application/useConsents';
import { useConsentText as useConsentTextWith } from './application/useConsentText';
import { createConsentAcceptance } from './ui/ConsentAcceptance';
import { createConsentsListScreen } from './ui/ConsentsListScreen';
import { CONSENT_DETAIL_ROUTE, CONSENTS_ROUTE } from './ui/routes';
import { consentsStrings } from './ui/strings.es-CO';

export type {
  Consent,
  ConsentProvider,
  ConsentScope,
  ConsentStatus,
  ConsentText,
} from './domain/consent';
export { scopesOf } from './domain/consent';
export type { CreateConsentInput } from './application/createConsent';
export type {
  ConsentRevokedEvent,
  ConsentRevokedListener,
  IdentityCheck,
  IdentityCheckRequest,
} from './application/revocation';
export { ConsentScopeCard, type ConsentScopeCardProps } from './ui/ConsentScopeCard';
export { ConsentCheckbox, type ConsentCheckboxProps } from './ui/ConsentCheckbox';
export type { ConsentAcceptanceProps } from './ui/ConsentAcceptance';

const deps: ConsentsDeps = { api: createConsentsApi(), appVersion, newIdempotencyKey };

/** The published consent text, purpose and term (React Query). */
export const useConsentText = () => useConsentTextWith(deps.api);

/** Records the acceptance of exactly what was shown as a pending consent. */
export const createConsent = (input: CreateConsentInput) => createConsentWith(deps, input);

const revocation = createRevocation(deps.api);

/** Every consent of the person with its status as of now (React Query). */
export const useConsents = () => useConsentsWith(deps.api);

/**
 * Revokes a consent at once (HU-008). M6's "Eliminar cuenta" on a connected account calls it.
 * The caller confirms with the person first; the consents screens do.
 */
export const revokeConsent = (id: string) => revocation.revokeConsent(id);

/** M5 subscribes here to delete the link's bank token from the vault after a revocation. */
export const onConsentRevoked = revocation.onConsentRevoked;

/** M1 or M2 install the biometric or password check that runs before a revocation. */
export const installIdentityCheck = revocation.installIdentityCheck;

/** The authorization checkbox and the "Ir al portal de <Entidad>" button of Conectar banco. */
export const ConsentAcceptance = createConsentAcceptance(deps);

export { CONSENTS_ROUTE };

/** Consentimientos (HU-007), pushed with the default transition. */
export const ConsentsListScreen = createConsentsListScreen({ api: deps.api, clock: systemClock });

/**
 * A ready "Gestión de cuenta" row for M1's Mi cuenta (`miCuentaRows.ts`), with the same shape as
 * its rows. The design opens consents from Privacidad y datos (M13); until that screen exists,
 * M1 can add this row in one line.
 */
export const consentsMiCuentaRow = {
  id: 'consents',
  ...consentsStrings.miCuentaRow,
  icon: 'shield',
  target: { kind: 'navigate', route: CONSENTS_ROUTE },
} as const;

export const routes: ModuleRoutes = {
  module: 'consents',
  screens: [
    { name: CONSENTS_ROUTE, component: ConsentsListScreen, path: 'consentimientos' },
    {
      // Replaced by the real detail in the next pull request of the stack.
      name: CONSENT_DETAIL_ROUTE,
      component: createPlaceholderScreen({
        title: 'Consentimiento',
        owner: 'M4 · Consentimientos',
      }),
    },
  ],
};
