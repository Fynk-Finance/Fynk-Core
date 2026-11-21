// The bank endpoints of the Fynk API (contracts/modules/bank.yaml, M5 link flow steps 2 to 5).
// Every POST to /bank/* needs a new X-Request-Nonce (replay protection, 5 minutes). Tokens
// travel only in request bodies, never in a URL, and are never logged.
import { api, unwrap, type ApiClient } from '@shared/api';

import type { BankApiPort } from '../application/ports';

export function createBankApi(client: ApiClient = api, nonce: () => string): BankApiPort {
  const headers = () => ({ 'X-Request-Nonce': nonce() });
  return {
    async authorize({ provider, consentId, codeChallenge, state }) {
      const r = await unwrap(
        client.POST('/bank/authorizations', {
          params: { header: headers() },
          body: { provider, consentId, codeChallenge, codeChallengeMethod: 'S256', state },
        }),
      );
      return {
        authorizationId: r.authorizationId,
        authorizeUrl: r.authorizeUrl,
        expiresAt: r.expiresAt,
      };
    },

    exchange(authorizationId, { code, codeVerifier }) {
      return unwrap(
        client.POST('/bank/authorizations/{id}/exchange', {
          params: { path: { id: authorizationId }, header: headers() },
          body: { code, codeVerifier },
        }),
      );
    },

    async accounts(linkId, accessToken) {
      const { items } = await unwrap(
        client.POST('/bank/accounts/query', {
          params: { header: headers() },
          body: { linkId, accessToken },
        }),
      );
      return items;
    },

    async transactions({ linkId, accessToken, providerAccountId, since, cursor }) {
      const page = await unwrap(
        client.POST('/bank/transactions/query', {
          params: { header: headers() },
          body: { linkId, accessToken, providerAccountId, since, ...(cursor ? { cursor } : {}) },
        }),
      );
      return { items: page.items, nextCursor: page.nextCursor ?? null };
    },

    refresh(linkId, refreshToken) {
      return unwrap(
        client.POST('/bank/tokens/refresh', {
          params: { header: headers() },
          body: { linkId, refreshToken },
        }),
      );
    },
  };
}
