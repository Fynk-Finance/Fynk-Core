// The rules of when and how far back to sync (HU-010, HU-011; M5 prompt, Sync engine).
import {
  COOLDOWN_MS,
  canStartSync,
  needsRefresh,
  shouldSyncOnForeground,
  syncSince,
} from './syncRules';

const at = (iso: string) => new Date(iso);

describe('cooldown of 60 seconds per link (HU-011)', () => {
  it('lets a link that never synced start at once', () => {
    expect(canStartSync({ lastAttemptAt: null }, at('2026-10-29T15:00:00Z'))).toBe(true);
  });

  it('refuses a second start within 60 seconds and allows it at 60', () => {
    const link = { lastAttemptAt: '2026-10-29T15:00:00.000Z' };
    expect(canStartSync(link, at('2026-10-29T15:00:59.999Z'))).toBe(false);
    expect(canStartSync(link, at('2026-10-29T15:01:00.000Z'))).toBe(true);
    expect(COOLDOWN_MS).toBe(60_000);
  });

  it('does not lock a link forever when the clock went back', () => {
    const link = { lastAttemptAt: '2026-10-29T15:10:00.000Z' };
    expect(canStartSync(link, at('2026-10-29T15:00:00.000Z'))).toBe(true);
  });
});

describe('back to the foreground (HU-011)', () => {
  it('syncs after 15 minutes or more in the background, not before', () => {
    const left = '2026-10-29T15:00:00.000Z';
    expect(shouldSyncOnForeground(left, at('2026-10-29T15:14:59.999Z'))).toBe(false);
    expect(shouldSyncOnForeground(left, at('2026-10-29T15:15:00.000Z'))).toBe(true);
  });

  it('does not sync when the app never went to the background', () => {
    expect(shouldSyncOnForeground(null, at('2026-10-29T15:15:00.000Z'))).toBe(false);
  });
});

describe('how far back to ask (HU-010, HU-011)', () => {
  it('asks for 12 months on the first sync', () => {
    expect(syncSince(null, at('2026-10-29T15:00:00Z'))).toBe('2025-10-29T15:00:00.000Z');
  });

  it('keeps the calendar: 12 months before 29 February is 28 February', () => {
    expect(syncSince(null, at('2028-02-29T12:00:00Z'))).toBe('2027-02-28T12:00:00.000Z');
  });

  it('asks again from 3 days before the last sync, to catch pending movements that got booked', () => {
    expect(syncSince('2026-10-29T15:00:00.000Z', at('2026-10-30T09:00:00Z'))).toBe(
      '2026-10-26T15:00:00.000Z',
    );
  });
});

describe('access token renewal (HU-030)', () => {
  const now = at('2026-10-29T15:00:00Z');

  it('renews when the token expires in less than 60 seconds, or already did', () => {
    expect(needsRefresh({ accessExpiresAt: '2026-10-29T15:00:59.000Z' }, now)).toBe(true);
    expect(needsRefresh({ accessExpiresAt: '2026-10-29T14:59:00.000Z' }, now)).toBe(true);
  });

  it('keeps a token with 60 seconds or more left', () => {
    expect(needsRefresh({ accessExpiresAt: '2026-10-29T15:01:00.000Z' }, now)).toBe(false);
  });
});
