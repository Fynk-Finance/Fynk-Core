// Ports of the bank module. Adapters call the Fynk API or the vault; tests use fakes.
import type { components } from '@shared/api';
import type { Account, Id, IsoDateTime, Transaction } from '@shared/domain/types';

import type { BankLink, BankTokens, NewBankLink } from '../domain/link';
import type { BankProvider } from '../domain/provider';

export interface ProvidersPort {
  /** `GET /providers`: the same list for everyone, in display order. */
  list(): Promise<BankProvider[]>;
}

export type RemoteAccount = components['schemas']['BankAccount'];
export type RemoteTransaction = components['schemas']['BankTransaction'];
export type TokenSet = components['schemas']['BankTokenSet'];

export interface Authorization {
  authorizationId: Id;
  /** Opened as is in the system browser: it already carries the challenge and the state. */
  authorizeUrl: string;
  expiresAt: IsoDateTime;
}

export interface TransactionsQuery {
  linkId: Id;
  accessToken: string;
  providerAccountId: string;
  since: IsoDateTime;
  cursor?: string;
}

/** The bank endpoints of the Fynk API. Tokens go only in bodies; every call has a new nonce. */
export interface BankApiPort {
  authorize(input: {
    provider: string;
    consentId: Id;
    codeChallenge: string;
    state: string;
  }): Promise<Authorization>;
  exchange(authorizationId: Id, input: { code: string; codeVerifier: string }): Promise<TokenSet>;
  accounts(linkId: Id, accessToken: string): Promise<RemoteAccount[]>;
  transactions(
    query: TransactionsQuery,
  ): Promise<{ items: RemoteTransaction[]; nextCursor: string | null }>;
  refresh(linkId: Id, refreshToken: string): Promise<TokenSet>;
}

/** M6's write API for M5 (M6 prompt: upsertFromSync, markLinkRevoked). */
export interface AccountsSink {
  upsertFromSync(accounts: Account[]): Promise<void>;
  markLinkRevoked(linkId: Id): Promise<void>;
}

/**
 * The writer M5 needs from M7 for the movements of one account (M7 has none yet). Upserts by
 * (accountId, providerTxId), deletes the pending movements since `since` that the bank no longer
 * returns, and gives the ids that were not in the vault before.
 */
export interface TransactionsSink {
  upsertFromSync(input: {
    accountId: Id;
    since: IsoDateTime;
    transactions: Transaction[];
  }): Promise<{ newIds: Id[] }>;
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
  /** A sync of the link started: the 60 second cooldown counts from here. */
  markAttempt(linkId: Id, at: IsoDateTime): Promise<void>;
  /** A sync of the link finished: the "last update" date and the start of the next overlap. */
  markSynced(linkId: Id, at: IsoDateTime): Promise<void>;
}
