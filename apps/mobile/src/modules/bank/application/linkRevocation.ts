// HU-008 on the phone: M4 tells M5 when a consent is revoked (onConsentRevoked), and M5 marks
// its links revoked and deletes their tokens from the vault, so no new sync can start.
// If the vault is locked this fails and M4 ignores it; the next sync gets 409 consent_revoked
// from the backend and revokes the link then (M5 step 4).
import type { Clock, Id } from '@shared/domain/types';

import type { LinkStore } from './ports';

export interface ConsentRevoked {
  consentId: Id;
  provider: string;
  revokedAt: string | undefined;
}

export interface LinkRevocationDeps {
  /** Read on every call: the vault may be locked when the module loads. */
  store: () => Pick<LinkStore, 'revokeByConsent'>;
  clock: Clock;
}

export async function revokeLinksOfConsent(
  { store, clock }: LinkRevocationDeps,
  event: ConsentRevoked,
): Promise<Id[]> {
  const at = event.revokedAt ?? clock.now().toISOString();
  return store().revokeByConsent(event.consentId, at);
}
