import { BACKGROUND_LOCK_MS, FRESH_LOGIN_MS, isFreshLogin, shouldLock } from './lockPolicy';

const FIVE_MIN = 5 * 60 * 1000;

describe('shouldLock', () => {
  it('uses a 5 minute limit', () => {
    expect(BACKGROUND_LOCK_MS).toBe(FIVE_MIN);
  });

  it('does not lock before or at exactly 5 minutes', () => {
    expect(shouldLock(1_000, 1_000)).toBe(false);
    expect(shouldLock(1_000, 1_000 + FIVE_MIN - 1)).toBe(false);
    expect(shouldLock(1_000, 1_000 + FIVE_MIN)).toBe(false);
  });

  it('locks after more than 5 minutes', () => {
    expect(shouldLock(1_000, 1_000 + FIVE_MIN + 1)).toBe(true);
    expect(shouldLock(0, 60 * 60 * 1000)).toBe(true);
  });
});

describe('isFreshLogin', () => {
  const now = new Date('2026-11-03T15:00:00Z');
  const ago = (ms: number) => new Date(now.getTime() - ms);

  it('uses a 5 minute window', () => {
    expect(FRESH_LOGIN_MS).toBe(FIVE_MIN);
  });

  it('is fresh up to exactly 5 minutes', () => {
    expect(isFreshLogin(ago(0), now)).toBe(true);
    expect(isFreshLogin(ago(FIVE_MIN - 1), now)).toBe(true);
    expect(isFreshLogin(ago(FIVE_MIN), now)).toBe(true);
  });

  it('is stale after 5 minutes', () => {
    expect(isFreshLogin(ago(FIVE_MIN + 1), now)).toBe(false);
  });

  it('is never fresh without a login', () => {
    expect(isFreshLogin(null, now)).toBe(false);
  });

  it('tolerates a phone clock slightly behind the token, but not far behind', () => {
    expect(isFreshLogin(ago(-30_000), now)).toBe(true);
    expect(isFreshLogin(ago(-(FIVE_MIN + 1)), now)).toBe(false);
  });
});
