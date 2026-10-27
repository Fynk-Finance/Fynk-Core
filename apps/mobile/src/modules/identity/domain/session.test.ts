import { isRefreshDue, parseTokenSet, type TokenSet } from './session';

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
