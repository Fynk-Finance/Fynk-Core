// The link flow on the phone, after M4 recorded the pending consent (M5 prompt, Link flow):
// PKCE and state, PAR through the API, the bank's portal in the system browser, the state
// check, the exchange, the tokens in the vault, and the accounts the bank returned.
// The verifier and the state stay in memory; nothing here logs a token or a code.
import { isApiError } from '@shared/api';
import type { Clock, Id } from '@shared/domain/types';

import { BANK_CALLBACK_URL, readCallback } from '../domain/callback';
import { createPkce, type RandomBytes } from '../domain/pkce';
import type { BankApiPort, LinkStore, RemoteAccount } from './ports';

/** Opens the URL in the system browser and resolves with the redirect, or how it was closed. */
export type AuthBrowser = (
  url: string,
  redirectUrl: string,
) => Promise<{ type: 'success'; url: string } | { type: 'cancel' | 'dismiss' }>;

export interface LinkBankDeps {
  api: BankApiPort;
  browser: AuthBrowser;
  /** Read on every call: the vault may be locked when the module loads. */
  store: () => Pick<LinkStore, 'saveLink'>;
  random: RandomBytes;
  clock: Clock;
}

export type LinkFailure =
  | 'state_mismatch' // the return is not the one this phone started (HU-030)
  | 'bank_error' // the bank answered with an error other than a denial
  | 'expired' // the 10 minutes of the authorization passed
  | 'already_linked'
  | 'unavailable'
  | 'offline'
  | 'device_required'
  | 'unknown';

export type LinkOutcome =
  /** `accounts` is null when the link worked but the accounts could not be read yet. */
  | { kind: 'linked'; linkId: Id; accounts: RemoteAccount[] | null }
  | { kind: 'cancelled' }
  | { kind: 'denied' }
  | { kind: 'failed'; reason: LinkFailure };

const FAILURES: Record<string, LinkFailure> = {
  authorization_not_found: 'expired',
  consent_already_linked: 'already_linked',
  provider_unavailable: 'unavailable',
  network_error: 'offline',
  device_required: 'device_required',
};

const failureOf = (error: unknown): LinkFailure =>
  (isApiError(error) && FAILURES[error.code]) || 'unknown';

export async function linkBank(
  { api, browser, store, random, clock }: LinkBankDeps,
  { provider, consentId }: { provider: string; consentId: Id },
): Promise<LinkOutcome> {
  const pkce = createPkce(random);
  let linkId: Id;
  let accessToken: string;
  try {
    const authorization = await api.authorize({
      provider,
      consentId,
      codeChallenge: pkce.challenge,
      state: pkce.state,
    });
    const back = await browser(authorization.authorizeUrl, BANK_CALLBACK_URL);
    if (back.type !== 'success') return { kind: 'cancelled' };

    const callback = readCallback(back.url, pkce.state);
    if (callback.kind === 'denied') return { kind: 'denied' };
    if (callback.kind === 'failed') return { kind: 'failed', reason: 'bank_error' };
    if (callback.kind !== 'code') return { kind: 'failed', reason: 'state_mismatch' };

    const tokens = await api.exchange(authorization.authorizationId, {
      code: callback.code,
      codeVerifier: pkce.verifier,
    });
    const now = clock.now();
    await store().saveLink(
      { id: tokens.linkId, provider, consentId, createdAt: now.toISOString() },
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessExpiresAt: new Date(now.getTime() + tokens.expiresIn * 1000).toISOString(),
      },
    );
    linkId = tokens.linkId;
    accessToken = tokens.accessToken;
  } catch (error) {
    return { kind: 'failed', reason: failureOf(error) };
  }

  // The link is made. If the accounts can't be read now, the first sync reads them (step 4).
  try {
    return { kind: 'linked', linkId, accounts: await api.accounts(linkId, accessToken) };
  } catch {
    return { kind: 'linked', linkId, accounts: null };
  }
}
