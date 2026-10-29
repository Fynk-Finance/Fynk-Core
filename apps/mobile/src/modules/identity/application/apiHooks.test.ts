import { createApiClient } from '@shared/api';
import { createFixedClock } from '@shared/testing';

import type { TokenSet } from '../domain/session';
import { createApiHooks } from './apiHooks';
import { createDevSession, shouldUseDevAuth } from './devSession';
import type { OidcPort, TokenStorePort } from './ports';
import { createSessionService } from './sessionService';

const stored: TokenSet = {
  accessToken: 'old-access',
  accessTokenExpiresAt: '2026-10-27T15:05:00.000Z',
  refreshToken: 'old-refresh',
  idToken: 'id',
};

function signedInSession() {
  const oidc: OidcPort = {
    authorize: jest.fn(),
    changePassword: jest.fn(),
    refresh: jest.fn(async () => ({
      ...stored,
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      accessTokenExpiresAt: '2026-10-27T15:10:00.000Z',
    })),
    endSession: jest.fn(async () => undefined),
  };
  const store: TokenStorePort = {
    load: async () => stored,
    save: async () => undefined,
    clear: async () => undefined,
  };
  const session = createSessionService({
    oidc,
    store,
    clock: createFixedClock('2026-10-27T15:00:00.000Z'),
  });
  return { session, oidc };
}

// HU-002 (prompt example): the API refuses an access token the app still thought valid
// (server side expiry, clock drift): one refresh, one retry with the new token.
it('an expired access token triggers one refresh and one retry', async () => {
  const { session, oidc } = signedInSession();
  await session.restore();
  const seen: (string | null)[] = [];
  const fetch = jest.fn(async (req: Request) => {
    const auth = req.headers.get('Authorization');
    seen.push(auth);
    if (auth !== 'Bearer new-access') return new Response(null, { status: 401 });
    return Response.json({ items: [] });
  });
  const client = createApiClient({
    baseUrl: 'http://api.test',
    hooks: () => createApiHooks(session, () => 'device-1'),
    fetch,
  });

  const { response } = await client.GET('/devices');

  expect(response.status).toBe(200);
  expect(oidc.refresh).toHaveBeenCalledTimes(1);
  expect(seen).toEqual(['Bearer old-access', 'Bearer new-access']);
  expect(fetch.mock.calls[1]?.[0].headers.get('X-Device-Id')).toBe('device-1');
});

it('sends no token when signed out', async () => {
  const { session } = signedInSession();
  await session.restore();
  await session.signOut();
  const fetch = jest.fn(async () => new Response(null, { status: 401 }));
  const client = createApiClient({
    baseUrl: 'http://api.test',
    hooks: () => createApiHooks(session, () => null),
    fetch,
  });
  await client.GET('/devices');
  expect(fetch).toHaveBeenCalledTimes(1);
  expect((fetch.mock.calls[0] as unknown as [Request])[0].headers.has('Authorization')).toBe(false);
});

describe('development dev-token session', () => {
  it('is used only in development builds that ask for it', () => {
    expect(shouldUseDevAuth('dev-token', true)).toBe(true);
    expect(shouldUseDevAuth('dev-token', false)).toBe(false);
    expect(shouldUseDevAuth(undefined, true)).toBe(false);
    expect(shouldUseDevAuth('yes', true)).toBe(false);
  });

  it('is signed in with the local API dev-token until signed out', async () => {
    const dev = createDevSession();
    await dev.restore();
    expect(dev.getState().status).toBe('signedIn');
    expect(await dev.getAccessToken()).toBe('dev-token');
    expect(await dev.refreshAccessToken()).toBe(false);
    await dev.signOut();
    expect(dev.getState().status).toBe('signedOut');
    expect(await dev.getAccessToken()).toBeNull();
    await dev.signIn();
    expect(await dev.getAccessToken()).toBe('dev-token');
  });
});
