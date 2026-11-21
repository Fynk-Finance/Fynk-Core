import { toBase64 } from './device';
import { authTimeOf, isRefreshDue, parseTokenSet, subjectOf, type TokenSet } from './session';

// Base64url without padding, as in a JWT. Each character becomes one byte.
const b64url = (text: string) =>
  toBase64(Uint8Array.from(text, (c) => c.charCodeAt(0)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const tokens: TokenSet = {
  accessToken: 'access',
  accessTokenExpiresAt: '2026-10-27T15:05:00.000Z',
  refreshToken: 'refresh',
  idToken: 'id',
};

describe('isRefreshDue', () => {
  it('refreshes 60 s before the access token expires, not earlier', () => {
    expect(isRefreshDue(tokens, new Date('2026-10-27T15:03:59.000Z'))).toBe(false);
    expect(isRefreshDue(tokens, new Date('2026-10-27T15:04:00.000Z'))).toBe(true);
    expect(isRefreshDue(tokens, new Date('2026-10-27T15:06:00.000Z'))).toBe(true);
  });

  it('treats an unreadable expiry as due', () => {
    expect(isRefreshDue({ ...tokens, accessTokenExpiresAt: 'not a date' }, new Date())).toBe(true);
  });
});

describe('parseTokenSet', () => {
  it('reads what the token store wrote', () => {
    expect(parseTokenSet(JSON.stringify(tokens))).toEqual(tokens);
  });

  it.each([
    ['not JSON', '{'],
    ['no refresh token', JSON.stringify({ ...tokens, refreshToken: '' })],
    ['a bad expiry', JSON.stringify({ ...tokens, accessTokenExpiresAt: 'soon' })],
    ['an array', '[]'],
  ])('returns null for %s', (_, raw) => {
    expect(parseTokenSet(raw)).toBeNull();
  });
});

describe('subjectOf', () => {
  const jwt = (claims: object) => `e30.${b64url(JSON.stringify(claims))}.sig`;

  it('reads the sub of a JWT payload, also without base64 padding', () => {
    expect(subjectOf(jwt({ sub: '3f8b2a54-6a1e-4c58-9d3b-7a1f0c2e9b11' }))).toBe(
      '3f8b2a54-6a1e-4c58-9d3b-7a1f0c2e9b11',
    );
    expect(subjectOf(jwt({ sub: 'ab', name: 'Camila Pérez' }))).toBe('ab');
  });

  it('is null for a token it cannot read or without sub', () => {
    expect(subjectOf('')).toBeNull();
    expect(subjectOf('not-a-jwt')).toBeNull();
    expect(subjectOf('a.%%%.c')).toBeNull();
    expect(subjectOf(`e30.${b64url('not json')}.sig`)).toBeNull();
    expect(subjectOf(jwt({ name: 'x' }))).toBeNull();
    expect(subjectOf(jwt({ sub: 7 }))).toBeNull();
  });
});

describe('authTimeOf', () => {
  const jwt = (claims: object) => `e30.${b64url(JSON.stringify(claims))}.sig`;

  it('reads auth_time, the seconds since the epoch of the last interactive login', () => {
    expect(authTimeOf(jwt({ sub: 'ab', auth_time: 1793113200 }))).toBe(1793113200);
  });

  it.each([
    ['missing', { sub: 'ab' }],
    ['a string', { auth_time: '1793113200' }],
    ['zero', { auth_time: 0 }],
    ['negative', { auth_time: -5 }],
    ['a fraction', { auth_time: 1793113200.5 }],
    ['null', { auth_time: null }],
  ])('is null when auth_time is %s', (_, claims) => {
    expect(authTimeOf(jwt(claims))).toBeNull();
  });

  it('is null for a token it cannot read', () => {
    expect(authTimeOf('')).toBeNull();
    expect(authTimeOf('not-a-jwt')).toBeNull();
    expect(authTimeOf('a.%%%.c')).toBeNull();
    expect(authTimeOf(`e30.${b64url('not json')}.sig`)).toBeNull();
    expect(authTimeOf(`e30.${b64url('null')}.sig`)).toBeNull();
  });
});
