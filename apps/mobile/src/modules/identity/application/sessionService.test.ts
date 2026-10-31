import { createFixedClock } from '@shared/testing';

import { toBase64 } from '../domain/device';
import type { TokenSet } from '../domain/session';
import {
  OidcError,
  type ActionStatus,
  type AuthMode,
  type OidcPort,
  type TokenStorePort,
} from './ports';
import { createSessionService } from './sessionService';

const NOW = '2026-10-27T15:00:00.000Z';

// Base64url without padding, as in a JWT. Each character becomes one byte.
const b64url = (text: string) =>
  toBase64(Uint8Array.from(text, (c) => c.charCodeAt(0)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

// An unsigned JWT with only the claims the session reads.
const jwt = (claims: object) => `e30.${b64url(JSON.stringify(claims))}.sig`;

// auth_time of token set n: 14:00:00 UTC plus n minutes, in seconds since the epoch.
const authTime = (n: number) => Date.parse('2026-10-27T14:00:00.000Z') / 1000 + n * 60;

function tokenSet(
  n: number,
  expiresAt = '2026-10-27T15:05:00.000Z',
  sub = 'user-a',
  loggedInAt = authTime(n),
): TokenSet {
  return {
    accessToken: `access-${n}`,
    accessTokenExpiresAt: expiresAt,
    refreshToken: `refresh-${n}`,
    idToken: jwt({ sub, n, auth_time: loggedInAt }),
  };
}

// A login typed now (auth_time = NOW), what reauthenticate gets from Keycloak.
const NOW_SECONDS = Date.parse(NOW) / 1000;
const fresh = (n: number, sub = 'user-a') => tokenSet(n, undefined, sub, NOW_SECONDS);

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
    changePassword: jest.fn(
      async (): Promise<{ tokens: TokenSet; actionStatus: ActionStatus }> => ({
        tokens: tokenSet(++issued),
        actionStatus: 'success',
      }),
    ),
    reauthenticate: jest.fn(async (): Promise<TokenSet> => fresh(++issued)),
    refresh: jest.fn(async (t: TokenSet) => ({
      ...tokenSet(++issued, '2026-10-27T15:10:00.000Z'),
      // Keycloak keeps the auth_time of the login across refreshes.
      idToken: t.idToken,
    })),
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

describe('changePassword', () => {
  type Answer = { tokens: TokenSet; actionStatus: ActionStatus };
  const signedIn = async () => {
    const ctx = setup(tokenSet(1));
    await ctx.service.restore();
    return ctx;
  };

  it('never keeps the tokens of another account signed in on the Keycloak page', async () => {
    const { service, oidc, store } = await signedIn();
    const other = tokenSet(2, undefined, 'user-b');
    oidc.changePassword.mockResolvedValueOnce({ tokens: other, actionStatus: 'success' });
    expect(await service.changePassword()).toBe('failed');
    expect(oidc.endSession).toHaveBeenCalledWith(other);
    expect(oidc.endSession).not.toHaveBeenCalledWith(tokenSet(1));
    expect(store.saved()).toEqual(tokenSet(1));
    expect(await service.getAccessToken()).toBe('access-1');
  });

  it('keeps nothing when the new id token cannot be read', async () => {
    const { service, oidc, store } = await signedIn();
    const unreadable = { ...tokenSet(2), idToken: 'not-a-jwt' };
    oidc.changePassword.mockResolvedValueOnce({ tokens: unreadable, actionStatus: 'success' });
    expect(await service.changePassword()).toBe('failed');
    expect(store.saved()).toEqual(tokenSet(1));
  });

  it('keeps the new tokens, ends the old Keycloak session and reports changed', async () => {
    const { service, oidc, store } = await signedIn();
    expect(await service.changePassword()).toBe('changed');
    expect(store.saved()).toEqual(tokenSet(2));
    expect(await service.getAccessToken()).toBe('access-2');
    expect(oidc.endSession).toHaveBeenCalledWith(tokenSet(1));
    expect(service.getState().status).toBe('signedIn');
  });

  it('does nothing when the browser is closed', async () => {
    const { service, oidc, store } = await signedIn();
    oidc.changePassword.mockRejectedValueOnce(new OidcError('cancelled'));
    expect(await service.changePassword()).toBe('cancelled');
    expect(store.saved()).toEqual(tokenSet(1));
    expect(oidc.endSession).not.toHaveBeenCalled();
    expect(service.getState().status).toBe('signedIn');
  });

  it('switches to the new session when Keycloak cancelled the action, and ends the old one', async () => {
    const { service, oidc, store } = await signedIn();
    oidc.changePassword.mockResolvedValueOnce({ tokens: tokenSet(5), actionStatus: 'cancelled' });
    expect(await service.changePassword()).toBe('cancelled');
    expect(store.saved()).toEqual(tokenSet(5));
    expect(oidc.endSession).toHaveBeenCalledWith(tokenSet(1));
  });

  it.each(['error', 'unknown'] as const)('reports failed for the status %s', async (status) => {
    const { service, oidc, store } = await signedIn();
    oidc.changePassword.mockResolvedValueOnce({ tokens: tokenSet(5), actionStatus: status });
    expect(await service.changePassword()).toBe('failed');
    expect(store.saved()).toEqual(tokenSet(5));
  });

  it.each(['network', 'rejected'] as const)('keeps the session on a %s failure', async (kind) => {
    const { service, oidc, store } = await signedIn();
    oidc.changePassword.mockRejectedValueOnce(new OidcError(kind));
    expect(await service.changePassword()).toBe('failed');
    expect(store.saved()).toEqual(tokenSet(1));
    expect(service.getState().status).toBe('signedIn');
  });

  it('ignores an error ending the old session', async () => {
    const { service, oidc } = await signedIn();
    oidc.endSession.mockRejectedValueOnce(new OidcError('network'));
    expect(await service.changePassword()).toBe('changed');
  });

  it('stays signed out when the person signs out while the browser is open', async () => {
    const { service, oidc, store } = await signedIn();
    const pending = deferred<Answer>();
    oidc.changePassword.mockReturnValueOnce(pending.promise);
    const running = service.changePassword();
    await service.signOut();
    pending.resolve({ tokens: tokenSet(9), actionStatus: 'success' });
    expect(await running).toBe('cancelled');
    expect(service.getState().status).toBe('signedOut');
    expect(store.saved()).toBeNull();
    expect(await service.getAccessToken()).toBeNull();
    // The Keycloak session the browser just opened is closed too.
    expect(oidc.endSession).toHaveBeenCalledWith(tokenSet(9));
  });

  it('shares one run between concurrent calls', async () => {
    const { service, oidc } = await signedIn();
    const pending = deferred<Answer>();
    oidc.changePassword.mockReturnValueOnce(pending.promise);
    const first = service.changePassword();
    const second = service.changePassword();
    pending.resolve({ tokens: tokenSet(3), actionStatus: 'success' });
    expect(await Promise.all([first, second])).toEqual(['changed', 'changed']);
    expect(oidc.changePassword).toHaveBeenCalledTimes(1);
  });

  it('does not open the browser when signed out', async () => {
    const { service, oidc } = setup();
    await service.restore();
    expect(await service.changePassword()).toBe('cancelled');
    expect(oidc.changePassword).not.toHaveBeenCalled();
  });
});

describe('reauthenticate', () => {
  const signedIn = async () => {
    const ctx = setup(tokenSet(1));
    await ctx.service.restore();
    return ctx;
  };

  it('keeps the new tokens, ends the old Keycloak session and moves lastLoginAt', async () => {
    const { service, oidc, store } = await signedIn();
    expect(await service.reauthenticate()).toBe('ok');
    expect(oidc.reauthenticate).toHaveBeenCalledTimes(1);
    expect(store.saved()).toEqual(fresh(2));
    expect(await service.getAccessToken()).toBe('access-2');
    expect(oidc.endSession).toHaveBeenCalledWith(tokenSet(1));
    expect(service.lastLoginAt()).toEqual(new Date(NOW_SECONDS * 1000));
  });

  it('does nothing when the browser is closed', async () => {
    const { service, oidc, store } = await signedIn();
    oidc.reauthenticate.mockRejectedValueOnce(new OidcError('cancelled'));
    expect(await service.reauthenticate()).toBe('cancelled');
    expect(store.saved()).toEqual(tokenSet(1));
    expect(oidc.endSession).not.toHaveBeenCalled();
    expect(service.lastLoginAt()).toEqual(new Date(authTime(1) * 1000));
  });

  it.each(['network', 'rejected'] as const)('fails when Keycloak says %s', async (kind) => {
    const { service, oidc, store } = await signedIn();
    oidc.reauthenticate.mockRejectedValueOnce(new OidcError(kind));
    expect(await service.reauthenticate()).toBe('failed');
    expect(store.saved()).toEqual(tokenSet(1));
  });

  it('never keeps the tokens of another account and keeps the old session', async () => {
    const { service, oidc, store } = await signedIn();
    const other = fresh(2, 'user-b');
    oidc.reauthenticate.mockResolvedValueOnce(other);
    expect(await service.reauthenticate()).toBe('failed');
    expect(oidc.endSession).toHaveBeenCalledWith(other);
    expect(oidc.endSession).not.toHaveBeenCalledWith(tokenSet(1));
    expect(store.saved()).toEqual(tokenSet(1));
    expect(await service.getAccessToken()).toBe('access-1');
    expect(service.lastLoginAt()).toEqual(new Date(authTime(1) * 1000));
  });

  it('fails when the new login is not fresh, so an old Keycloak session cannot unlock', async () => {
    const { service, oidc, store } = await signedIn();
    // Logged in two minutes before the call started, beyond the 60 s allowed for clock skew.
    const stale = tokenSet(2, undefined, 'user-a', NOW_SECONDS - 120);
    oidc.reauthenticate.mockResolvedValueOnce(stale);
    expect(await service.reauthenticate()).toBe('failed');
    expect(oidc.endSession).toHaveBeenCalledWith(stale);
    expect(store.saved()).toEqual(tokenSet(1));
    expect(service.lastLoginAt()).toEqual(new Date(authTime(1) * 1000));
  });

  it('fails when the new id token has no auth_time', async () => {
    const { service, oidc, store } = await signedIn();
    const blind = { ...fresh(2), idToken: jwt({ sub: 'user-a' }) };
    oidc.reauthenticate.mockResolvedValueOnce(blind);
    expect(await service.reauthenticate()).toBe('failed');
    expect(store.saved()).toEqual(tokenSet(1));
  });

  it('stays signed out when the person signs out while the browser is open', async () => {
    const { service, oidc, store } = await signedIn();
    const pending = deferred<TokenSet>();
    oidc.reauthenticate.mockReturnValueOnce(pending.promise);
    const running = service.reauthenticate();
    await service.signOut();
    pending.resolve(fresh(9));
    expect(await running).toBe('cancelled');
    expect(service.getState().status).toBe('signedOut');
    expect(store.saved()).toBeNull();
    expect(service.lastLoginAt()).toBeNull();
    expect(oidc.endSession).toHaveBeenCalledWith(fresh(9));
  });

  it('shares one run between concurrent calls', async () => {
    const { service, oidc } = await signedIn();
    const pending = deferred<TokenSet>();
    oidc.reauthenticate.mockReturnValueOnce(pending.promise);
    const first = service.reauthenticate();
    const second = service.reauthenticate();
    pending.resolve(fresh(3));
    expect(await Promise.all([first, second])).toEqual(['ok', 'ok']);
    expect(oidc.reauthenticate).toHaveBeenCalledTimes(1);
  });

  it('does not open the browser when signed out', async () => {
    const { service, oidc } = setup();
    await service.restore();
    expect(await service.reauthenticate()).toBe('cancelled');
    expect(oidc.reauthenticate).not.toHaveBeenCalled();
  });
});

describe('userId', () => {
  it('is the sub of the id token after sign in and restore, and null when signed out', async () => {
    const { service } = setup();
    await service.restore();
    expect(service.userId()).toBeNull();
    await service.signIn();
    expect(service.userId()).toBe('user-a');
    await service.signOut();
    expect(service.userId()).toBeNull();
  });

  it('is read from the stored tokens on restore', async () => {
    const { service } = setup(tokenSet(1, undefined, 'user-b'));
    await service.restore();
    expect(service.userId()).toBe('user-b');
  });

  it('is null when the id token has no sub', async () => {
    const { service } = setup({ ...tokenSet(1), idToken: jwt({ auth_time: authTime(1) }) });
    await service.restore();
    expect(service.userId()).toBeNull();
  });
});

describe('lastLoginAt', () => {
  it('is the auth_time of the id token after sign in, and null when signed out', async () => {
    const { service } = setup();
    await service.restore();
    expect(service.lastLoginAt()).toBeNull();
    await service.signIn();
    expect(service.lastLoginAt()).toEqual(new Date(authTime(1) * 1000));
    await service.signOut();
    expect(service.lastLoginAt()).toBeNull();
  });

  it('is read from the stored tokens on restore', async () => {
    const { service } = setup(tokenSet(7));
    await service.restore();
    expect(service.lastLoginAt()).toEqual(new Date(authTime(7) * 1000));
  });

  it('does not move on a refresh, because only a login changes auth_time', async () => {
    const { service, clock } = setup(tokenSet(1, '2026-10-27T15:00:30.000Z'));
    await service.restore();
    expect(clock.now()).toEqual(new Date(NOW));
    expect(await service.refreshAccessToken()).toBe(true);
    expect(service.lastLoginAt()).toEqual(new Date(authTime(1) * 1000));
  });

  it('is null when the id token has no readable auth_time', async () => {
    const { service } = setup({ ...tokenSet(1), idToken: jwt({ sub: 'user-a' }) });
    await service.restore();
    expect(service.lastLoginAt()).toBeNull();
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
