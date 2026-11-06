// "Eliminar cuenta" on a connected account (Detalle de cuenta, M6) ends the bank link by
// revoking its consent (M4 prompt; HU-008). M6 knows the account's link; M5 knows the link's
// consent and entity. M4 asks for the identity check and revokes, and its revocation notice
// then ends the link here and marks the accounts in M6 (index.ts).
import type { Id } from '@shared/domain/types';

import type { BankLink } from '../domain/link';

export type DisconnectResult = 'revoked' | 'cancelled' | 'not_found';

export interface DisconnectDeps {
  links: () => Promise<BankLink[]>;
  entityName: (provider: string) => Promise<string>;
  /** M4's revokeConsentAfterCheck. */
  revoke: (consentId: Id, entity: string) => Promise<'revoked' | 'cancelled'>;
}

export async function disconnectLink(deps: DisconnectDeps, linkId: Id): Promise<DisconnectResult> {
  const link = (await deps.links()).find((l) => l.id === linkId);
  if (!link) return 'not_found';
  if (link.status === 'revoked') return 'revoked';
  return deps.revoke(link.consentId, await deps.entityName(link.provider));
}
