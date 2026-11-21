import { authorize, refresh } from 'react-native-app-auth';

import { isOidcError } from '../../application/ports';
import type { TokenSet } from '../../domain/session';
import { classifyAppAuthError, createAppAuthOidc } from './appAuthOidc';
import { createOidcConfig } from './config';

jest.mock('react-native-app-auth', () => ({ authorize: jest.fn(), refresh: jest.fn() }));

const mockAuthorize = authorize as jest.MockedFunction<typeof authorize>;
const mockRefresh = refresh as jest.MockedFunction<typeof refresh>;

const config = createOidcConfig('http://localhost:8081/realms/fynk/', true);

const tokens: TokenSet = {
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-10-27T15:05:00.000Z',
  refreshToken: 'refresh-1',
  idToken: 'id-1',
};

const authorizeResult = {
  accessToken: 'access-1',
  accessTokenExpirationDate: '2026-10-27T15:05:00.000Z',
  idToken: 'id-1',
  refreshToken: 'refresh-1',
  tokenType: 'Bearer',
  scopes: ['openid'],
  authorizationCode: 'code',
};

beforeEach(() => jest.clearAllMocks());

describe('config', () => {
  it('uses the fynk-mobile client, its redirect and no offline_access', () => {
    expect(config).toEqual({
      issuer: 'http://localhost:8081/realms/fynk',
      clientId: 'fynk-mobile',
      redirectUrl: 'co.fynk.app://oauth/callback',
      scopes: ['openid', 'profile', 'email'],
      allowInsecureHttp: true,
    });
  });

  it('allows plain HTTP only for a development build', () => {
    expect(createOidcConfig(undefined, false).allowInsecureHttp).toBe(false);
    expect(createOidcConfig('https://auth.fynk.co/realms/fynk', true).allowInsecureHttp).toBe(
      false,
    );
  });
});

describe('authorize', () => {
  it('signs in with PKCE in an ephemeral system browser session', async () => {
    mockAuthorize.mockResolvedValueOnce(authorizeResult);
    const oidc = createAppAuthOidc(config);

    expect(await oidc.authorize('signIn')).toEqual(tokens);
    const sent = mockAuthorize.mock.calls[0]?.[0];
    expect(sent).toMatchObject({
      issuer: config.issuer,
      clientId: 'fynk-mobile',
      redirectUrl: 'co.fynk.app://oauth/callback',
      usePKCE: true,
      iosPrefersEphemeralSession: true,
      androidPrefersEphemeralSession: true,
    });
    expect(sent?.scopes).not.toContain('offline_access');
    expect(sent?.additionalParameters).toBeUndefined();
  });

  it('opens registration with prompt=create for sign up', async () => {
    mockAuthorize.mockResolvedValueOnce(authorizeResult);
    await createAppAuthOidc(config).authorize('signUp');
    expect(mockAuthorize.mock.calls[0]?.[0].additionalParameters).toEqual({ prompt: 'create' });
  });

  it('turns library errors into typed errors', async () => {
    mockAuthorize.mockRejectedValueOnce(
      Object.assign(new Error('User cancelled flow'), { code: 'authentication_error' }),
    );
    await expect(createAppAuthOidc(config).authorize('signIn')).rejects.toMatchObject({
      kind: 'cancelled',
    });
  });

  it('treats the access_denied redirect after a password reset as a cancel', async () => {
    mockAuthorize.mockRejectedValueOnce(
      Object.assign(new Error('access_denied'), { code: 'access_denied' }),
    );
    await expect(createAppAuthOidc(config).authorize('signIn')).rejects.toMatchObject({
      kind: 'cancelled',
    });
  });
});

describe('changePassword', () => {
  it('asks Keycloak for the UPDATE_PASSWORD action and returns the tokens and the status', async () => {
    mockAuthorize.mockResolvedValueOnce({
      ...authorizeResult,
      authorizeAdditionalParameters: { kc_action_status: 'success' },
    });
    const result = await createAppAuthOidc(config).changePassword();
    expect(result).toEqual({ tokens, actionStatus: 'success' });
    const sent = mockAuthorize.mock.calls[0]?.[0];
    expect(sent?.additionalParameters).toEqual({ kc_action: 'UPDATE_PASSWORD' });
    expect(sent).toMatchObject({ usePKCE: true, iosPrefersEphemeralSession: true });
  });

  it.each([
    ['success', 'success'],
    ['cancelled', 'cancelled'],
    ['error', 'error'],
    ['something-else', 'unknown'],
    [undefined, 'unknown'],
  ])('reads kc_action_status %s as %s', async (raw, expected) => {
    mockAuthorize.mockResolvedValueOnce({
      ...authorizeResult,
      authorizeAdditionalParameters: raw === undefined ? undefined : { kc_action_status: raw },
    });
    expect((await createAppAuthOidc(config).changePassword()).actionStatus).toBe(expected);
  });

  it('turns a closed browser into a cancelled error', async () => {
    mockAuthorize.mockRejectedValueOnce(
      Object.assign(new Error('User cancelled flow'), { code: 'authentication_error' }),
    );
    await expect(createAppAuthOidc(config).changePassword()).rejects.toMatchObject({
      kind: 'cancelled',
    });
  });
});

describe('reauthenticate', () => {
  it('forces a fresh login with prompt=login and max_age=0 in the ephemeral browser session', async () => {
    mockAuthorize.mockResolvedValueOnce(authorizeResult);
    expect(await createAppAuthOidc(config).reauthenticate()).toEqual(tokens);
    const sent = mockAuthorize.mock.calls[0]?.[0];
    expect(sent?.additionalParameters).toEqual({ prompt: 'login', max_age: '0' });
    expect(sent).toMatchObject({ usePKCE: true, iosPrefersEphemeralSession: true });
  });

  it('turns a closed browser into a cancelled error', async () => {
    mockAuthorize.mockRejectedValueOnce(
      Object.assign(new Error('User cancelled flow'), { code: 'authentication_error' }),
    );
    await expect(createAppAuthOidc(config).reauthenticate()).rejects.toMatchObject({
      kind: 'cancelled',
    });
  });
});

describe('classifyAppAuthError', () => {
  it.each([
    [{ code: 'authentication_error', message: 'User cancelled flow' }, 'cancelled'],
    [
      { code: 'authentication_failed', message: '(org.openid.appauth.general error -3.)' },
      'cancelled',
    ],
    [{ code: 'access_denied', message: 'access_denied' }, 'cancelled'],
    [{ code: 'not_access_denied_at_all', message: 'x' }, 'rejected'],
    [{ code: 'unauthorized_client', message: 'Client not allowed' }, 'rejected'],
    [{ code: 'service_configuration_fetch_error', message: 'x' }, 'network'],
    [{ code: 'token_refresh_failed', message: 'Network error' }, 'network'],
    [{ code: 'token_refresh_failed', message: 'The request timed out.' }, 'network'],
    [{ code: 'invalid_grant', message: 'Token is not active' }, 'rejected'],
    [{ code: 'invalid_grant', message: 'Session not active' }, 'rejected'],
    [undefined, 'rejected'],
  ])('%p is %s', (error, kind) => {
    expect(classifyAppAuthError(error)).toBe(kind);
  });
});

describe('refresh', () => {
  it('sends the refresh token and keeps the rotated one', async () => {
    mockRefresh.mockResolvedValueOnce({
      accessToken: 'access-2',
      accessTokenExpirationDate: '2026-10-27T15:10:00.000Z',
      idToken: 'id-2',
      refreshToken: 'refresh-2',
      tokenType: 'Bearer',
    });
    const next = await createAppAuthOidc(config).refresh(tokens);
    expect(mockRefresh.mock.calls[0]?.[1]).toEqual({ refreshToken: 'refresh-1' });
    expect(next).toEqual({
      accessToken: 'access-2',
      accessTokenExpiresAt: '2026-10-27T15:10:00.000Z',
      refreshToken: 'refresh-2',
      idToken: 'id-2',
    });
  });

  it('keeps the current refresh token when the response has none', async () => {
    mockRefresh.mockResolvedValueOnce({
      accessToken: 'access-2',
      accessTokenExpirationDate: '2026-10-27T15:10:00.000Z',
      idToken: '',
      refreshToken: null,
      tokenType: 'Bearer',
    });
    const next = await createAppAuthOidc(config).refresh(tokens);
    expect(next.refreshToken).toBe('refresh-1');
    expect(next.idToken).toBe('id-1');
  });

  it('reports a revoked session as rejected', async () => {
    mockRefresh.mockRejectedValueOnce(
      Object.assign(new Error('Session not active'), { code: 'invalid_grant' }),
    );
    const error = await createAppAuthOidc(config)
      .refresh(tokens)
      .catch((e: unknown) => e);
    expect(isOidcError(error, 'rejected')).toBe(true);
  });
});

describe('endSession', () => {
  it('posts the refresh token in the body, never in the URL', async () => {
    const fetchFn = jest.fn(
      async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }),
    );
    await createAppAuthOidc(config, fetchFn).endSession(tokens);

    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe('http://localhost:8081/realms/fynk/protocol/openid-connect/logout');
    expect(url).not.toContain('refresh-1');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({
      client_id: 'fynk-mobile',
      refresh_token: 'refresh-1',
    });
  });

  it('reports an unreachable or refusing Keycloak', async () => {
    const offline = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    await expect(createAppAuthOidc(config, offline).endSession(tokens)).rejects.toMatchObject({
      kind: 'network',
    });

    const refusing = jest.fn(async () => new Response(null, { status: 400 }));
    await expect(createAppAuthOidc(config, refusing).endSession(tokens)).rejects.toMatchObject({
      kind: 'rejected',
    });
  });
});
