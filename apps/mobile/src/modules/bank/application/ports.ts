// Ports of the bank module. Adapters call the Fynk API or the vault; tests use fakes.
import type { Id, IsoDateTime } from '@shared/domain/types';

import type { BankLink, BankTokens, NewBankLink } from '../domain/link';
import type { BankProvider } from '../domain/provider';

export interface ProvidersPort {
  /** `GET /providers`: the same list for everyone, in display order. */
  list(): Promise<BankProvider[]>;
}

/** Links and their tokens in the vault (tables bank_links and bank_tokens). */
export interface LinkStore {
  /** A new active link with its first tokens. One link per consent: a second one is refused. */
  saveLink(link: NewBankLink, tokens: BankTokens): Promise<void>;
  /** Every link, active or revoked, oldest first. Never includes tokens. */
  getLinks(): Promise<BankLink[]>;
  /** The tokens of an active link, or null when it has none or was revoked. */
  getTokens(linkId: Id): Promise<BankTokens | null>;
  /** New tokens after a refresh. Ignored when the link was revoked meanwhile. */
  updateTokens(linkId: Id, tokens: BankTokens): Promise<void>;
  /** Marks the link revoked (keeping the first date) and deletes its tokens. */
  revokeLink(linkId: Id, at: IsoDateTime): Promise<void>;
  /** Same for every link of a consent. Returns their ids (none when it was never linked). */
  revokeByConsent(consentId: Id, at: IsoDateTime): Promise<Id[]>;
}
