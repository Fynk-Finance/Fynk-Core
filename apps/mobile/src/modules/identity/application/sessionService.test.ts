import { createFixedClock } from '@shared/testing';

import type { TokenSet } from '../domain/session';
import { OidcError, type AuthMode, type OidcPort, type TokenStorePort } from './ports';
import { createSessionService } from './sessionService';

const NOW = '2026-10-27T15:00:00.000Z';

function tokenSet(n: number, expiresAt = '2026-10-27T15:05:00.000Z'): TokenSet {
  return {
    accessToken: `access-${n}`,
    accessTokenExpiresAt: expiresAt,
    refreshToken: `refresh-${n}`,
    idToken: `id-${n}`,
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(stored: TokenSet | null = null) {
  let saved: TokenSet | null = stored;
  const store: TokenStorePort & { saved: () => TokenSet | null } = {
    load: jest.fn(async () => saved),
    save: jest.fn(async (t: TokenSet) => {
      saved = t;
    }),
    clear: jest.fn(async () => {
      saved = null;
    }),
    saved: () => saved,
  };
  let issued = stored ? 1 : 0; // the stored set counts as the first one issued
  const oidc = {
    authorize: jest.fn(async (_mode: AuthMode) => tokenSet(++issued)),
    refresh: jest.fn(async (_t: TokenSet) => tokenSet(++issued, '2026-10-27T15:10:00.000Z')),
    endSession: jest.fn(async (_t: TokenSet) => undefined),
  } satisfies OidcPort;
  const clock = createFixedClock(NOW);
  const service = createSessionService({ oidc, store, clock });
  return { service, store, oidc, clock };
}

describe('restore', () => {
  it('signs in from the stored tokens without opening the browser', async () => {
    const { service, oidc } = setup(tokenSet(7));
    expect(service.getState().status).toBe('restoring');
    await service.restore();
    expect(service.getState().status).toBe('signedIn');
    expect(oidc.authorize).not.toHaveBeenCalled();
    expect(await service.getAccessToken()).toBe('access-7');
  });

  it('shows Inicio when nothing is stored or the store fails', async () => {
    const empty = setup();
    await empty.service.restore();
    expect(empty.service.getState().status).toBe('signedOut');

    const broken = setup();
    (broken.store.load as jest.Mock).mockRejectedValueOnce(new Error('keychain locked'));
    await broken.service.restore();
    expect(broken.service.getState().status).toBe('signedOut');
  });
});

describe('signIn and signUp', () => {
  it('opens Keycloak in the right mode and keeps the tokens', async () => {
    const { service, oidc, store } = setup();
    await service.restore();
    await service.signUp();
    expect(oidc.authorize).toHaveBeenLastCalledWith('signUp');
    expect(service.getState()).toEqual({ status: 'signedIn', busy: false, error: null });
    expect(store.saved()).toEqual(tokenSet(1));

    await service.signOut();
    await service.signIn();
    expect(oidc.authorize).toHaveBeenLastCalledWith('signIn');
  });

  it('is busy while the browser is open and ignores a second tap', async () => {
    const { service, oidc } = setup();
    await service.restore();
    const pending = deferred<TokenSet>();
    oidc.authorize.mockReturnValueOnce(pending.promise);
    const first = service.signIn();
    const second = service.signUp();
    expect(service.getState().busy).toBe(true);
    pending.resolve(tokenSet(1));
    await Promise.all([first, second]);
    expect(oidc.authorize).toHaveBeenCalledTimes(1);
    expect(service.getState().busy).toBe(false);
  });

  it.each([
    ['cancelled', null],
    ['network', 'network'],
    ['rejected', 'unknown'],
  ] as const)('a %s browser flow leaves the user signed out with error %p', async (kind, error) => {
    const { service, oidc } = setup();
    await service.restore();
    oidc.authorize.mockRejectedValueOnce(new OidcError(kind));
    await service.signIn();
    expect(service.getState()).toEqual({ status: 'signedOut', busy: false, error });
  });
});

describe('access token refresh', () => {
  it('refreshes 60 s before expiry, not earlier', async () => {
    const { service, oidc, clock, store } = setup(tokenSet(1));
    await service.restore();
    clock.set('2026-10-27T15:03:59.000Z');
    expect(await service.getAccessToken()).toBe('access-1');
    expect(oidc.refresh).not.toHaveBeenCalled();

    clock.set('2026-10-27T15:04:00.000Z');
    expect(await service.getAccessToken()).toBe('access-2');
    expect(oidc.refresh).toHaveBeenCalledTimes(1);
    expect(store.saved()?.refreshToken).toBe('refresh-2');
  });

  it('runs one refresh for concurrent callers, so the rotated refresh token is used once', async () => {
    const { service, oidc, clock } = setup(tokenSet(1));
    await service.restore();
    clock.set('2026-10-27T15:04:30.000Z');
    const results = await Promise.all([
      service.getAccessToken(),
      service.getAccessToken(),
      service.refreshAccessToken(),
    ]);
    expect(oidc.refresh).toHaveBeenCalledTimes(1);
    expect(results).toEqual(['access-2', 'access-2', true]);
  });

  it('signs out when Keycloak rejects the refresh (session expired or revoked)', async () => {
    const { service, oidc, store } = setup(tokenSet(1));
    await service.restore();
    oidc.refresh.mockRejectedValueOnce(new OidcError('rejected'));
    expect(await service.refreshAccessToken()).toBe(false);
    expect(service.getState().status).toBe('signedOut');
    expect(store.clear).toHaveBeenCalled();
    expect(await service.getAccessToken()).toBeNull();
  });

  it('keeps the session when Keycloak cannot be reached', async () => {
    const { service, oidc } = setup(tokenSet(1));
    await service.restore();
    oidc.refresh.mockRejectedValueOnce(new OidcError('network'));
    expect(await service.refreshAccessToken()).toBe(false);
    expect(service.getState().status).toBe('signedIn');
    expect(await service.getAccessToken()).toBe('access-1');
  });

  it('does not bring back a session signed out during a refresh', async () => {
    const { service, oidc, store } = setup(tokenSet(1));
    await service.restore();
    const pending = deferred<TokenSet>();
    oidc.refresh.mockReturnValueOnce(pending.promise);
    const refreshing = service.refreshAccessToken();
    await service.signOut();
    pending.resolve(tokenSet(9));
    expect(await refreshing).toBe(false);
    expect(service.getState().status).toBe('signedOut');
    expect(store.saved()).toBeNull();
  });
});

describe('signOut', () => {
  it('ends the Keycloak session and forgets the tokens', async () => {
    const { service, oidc, store } = setup(tokenSet(1));
    await service.restore();
    await service.signOut();
    expect(oidc.endSession).toHaveBeenCalledWith(tokenSet(1));
    expect(store.saved()).toBeNull();
    expect(service.getState().status).toBe('signedOut');
  });

  it('forgets the tokens even when Keycloak cannot be reached', async () => {
    const { service, oidc, store } = setup(tokenSet(1));
    await service.restore();
    oidc.endSession.mockRejectedValueOnce(new OidcError('network'));
    await service.signOut();
    expect(store.saved()).toBeNull();
    expect(service.getState().status).toBe('signedOut');
  });
});

it('tells subscribers about every change', async () => {
  const { service } = setup();
  const listener = jest.fn();
  const unsubscribe = service.subscribe(listener);
  await service.restore();
  await service.signIn();
  expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3); // signedOut, busy, signedIn
  unsubscribe();
  await service.signOut();
  const calls = listener.mock.calls.length;
  await service.signIn();
  expect(listener).toHaveBeenCalledTimes(calls);
});
