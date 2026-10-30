// The bank endpoints of the Fynk API (contracts/modules/bank.yaml). Tokens travel only in
// bodies and every call sends a new X-Request-Nonce (CLAUDE.md, Security rules).
import { createApiClient, isApiError } from '@shared/api';

import { createBankApi } from './bankApi';

const LINK = '7d5c1c4e-2f1b-4c3a-9a55-0b1c2d3e4f50';
const AUTH = '0f8e7d6c-5b4a-4392-8170-6f5e4d3c2b1a';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });

function setup(...responses: Response[]) {
  const fetch = jest.fn(async (_: Request) => responses.shift() ?? json(500, {}));
  const client = createApiClient({
    baseUrl: 'http://api.test/v1',
    hooks: () => ({ getAccessToken: () => 'session' }),
    fetch,
  });
  let n = 0;
  const api = createBankApi(client, () => `nonce-${String(++n).padStart(10, '0')}`);
  const sent = async (i: number) => {
    const request = fetch.mock.calls[i]![0];
    return {
      method: request.method,
      url: request.url,
      nonce: request.headers.get('X-Request-Nonce'),
      body: (await request.clone().json()) as Record<string, unknown>,
    };
  };
  return { api, sent };
}

const tokenSet = {
  linkId: LINK,
  provider: 'banco-demo',
  accessToken: 'at-1',
  refreshToken: 'rt-1',
  expiresIn: 300,
};

it('creates the authorization with the challenge and the state', async () => {
  const { api, sent } = setup(
    json(201, {
      authorizationId: AUTH,
      authorizeUrl: 'https://auth.test/x',
      expiresAt: '2026-10-29T15:10:00Z',
    }),
  );
  const result = await api.authorize({
    provider: 'banco-demo',
    consentId: 'c0ffee00-0000-4000-8000-000000000001',
    codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    state: 'state-123456',
  });
  expect(result).toEqual({
    authorizationId: AUTH,
    authorizeUrl: 'https://auth.test/x',
    expiresAt: '2026-10-29T15:10:00Z',
  });
  const request = await sent(0);
  expect(request).toMatchObject({
    method: 'POST',
    url: 'http://api.test/v1/bank/authorizations',
    nonce: 'nonce-0000000001',
  });
  expect(request.body).toEqual({
    provider: 'banco-demo',
    consentId: 'c0ffee00-0000-4000-8000-000000000001',
    codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    codeChallengeMethod: 'S256',
    state: 'state-123456',
  });
});

it('exchanges the code with the verifier and returns the tokens', async () => {
  const { api, sent } = setup(json(200, tokenSet));
  expect(await api.exchange(AUTH, { code: 'code-1', codeVerifier: 'v'.repeat(43) })).toEqual(
    tokenSet,
  );
  const request = await sent(0);
  expect(request.url).toBe(`http://api.test/v1/bank/authorizations/${AUTH}/exchange`);
  expect(request.body).toEqual({ code: 'code-1', codeVerifier: 'v'.repeat(43) });
});

it('queries the accounts with the access token in the body, never in the URL', async () => {
  const account = {
    providerAccountId: 'acc-1',
    kind: 'savings',
    displayName: 'Banco Demo · Ahorros',
    last4: '4321',
    currency: 'COP',
    balanceMinor: 320_000_000,
    status: 'active',
    isSimulated: true,
  };
  const { api, sent } = setup(json(200, { items: [account] }));
  expect(await api.accounts(LINK, 'at-1')).toEqual([account]);
  const request = await sent(0);
  expect(request.url).toBe('http://api.test/v1/bank/accounts/query');
  expect(request.url).not.toContain('at-1');
  expect(request.body).toEqual({ linkId: LINK, accessToken: 'at-1' });
});

it('pages the movements of an account by cursor', async () => {
  const tx = {
    providerTxId: 'tx-1',
    bookedAt: '2026-10-20T15:00:00Z',
    amountMinor: -18_430_000,
    description: 'Supermercado',
    status: 'booked',
  };
  const { api, sent } = setup(
    json(200, { items: [tx], nextCursor: 'p2' }),
    json(200, { items: [] }),
  );
  const query = {
    linkId: LINK,
    accessToken: 'at-1',
    providerAccountId: 'acc-1',
    since: '2025-10-29T00:00:00Z',
  };
  expect(await api.transactions(query)).toEqual({ items: [tx], nextCursor: 'p2' });
  expect(await api.transactions({ ...query, cursor: 'p2' })).toEqual({
    items: [],
    nextCursor: null,
  });
  expect((await sent(1)).body).toEqual({ ...query, cursor: 'p2' });
});

it('refreshes the tokens with the old refresh token in the body', async () => {
  const { api, sent } = setup(
    json(200, { ...tokenSet, accessToken: 'at-2', refreshToken: 'rt-2' }),
  );
  expect(await api.refresh(LINK, 'rt-1')).toMatchObject({
    accessToken: 'at-2',
    refreshToken: 'rt-2',
  });
  const request = await sent(0);
  expect(request.url).toBe('http://api.test/v1/bank/tokens/refresh');
  expect(request.body).toEqual({ linkId: LINK, refreshToken: 'rt-1' });
});

it('sends a new nonce on every call', async () => {
  const { api, sent } = setup(json(200, { items: [] }), json(200, { items: [] }));
  await api.accounts(LINK, 'at-1');
  await api.accounts(LINK, 'at-1');
  expect((await sent(0)).nonce).not.toBe((await sent(1)).nonce);
});

it('passes the stable error codes of the API to the caller', async () => {
  const { api } = setup(
    json(409, {
      type: '/problems/consent_revoked',
      title: 'Consent revoked',
      status: 409,
      code: 'consent_revoked',
    }),
  );
  const error = await api.accounts(LINK, 'at-1').catch((e: unknown) => e);
  expect(isApiError(error) && error.code).toBe('consent_revoked');
});
