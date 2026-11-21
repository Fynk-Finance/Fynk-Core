// A bank link: one consent turned into tokens at one entity (M5 link flow, step 5). Pure: no
// React, no I/O. The tokens live only in the phone's vault (CLAUDE.md, Where data lives).
import type { Id, IsoDateTime } from '@shared/domain/types';

export type LinkStatus = 'active' | 'revoked';

export interface NewBankLink {
  /** The backend's link id (`POST /bank/authorizations/{id}/exchange`). */
  id: Id;
  provider: string;
  consentId: Id;
  createdAt: IsoDateTime;
}

export interface BankLink extends NewBankLink {
  status: LinkStatus;
  /** End of the last sync that finished (HU-010, "Fecha de última actualización"). */
  lastSyncedAt: IsoDateTime | null;
  /** Start of the last sync, finished or not: the 60 second cooldown counts from here (HU-011). */
  lastAttemptAt: IsoDateTime | null;
  revokedAt: IsoDateTime | null;
}

export interface BankTokens {
  accessToken: string;
  refreshToken: string;
  accessExpiresAt: IsoDateTime;
}
