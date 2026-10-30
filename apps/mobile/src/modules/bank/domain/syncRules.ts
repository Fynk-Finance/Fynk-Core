// When and how far back the phone syncs a bank link (CLAUDE.md, Architecture rule 4; M5 prompt,
// Sync engine). Pure: the time comes from the caller's clock.
import type { IsoDateTime } from '@shared/domain/types';

/** At least 60 seconds between two syncs of the same link (HU-011). */
export const COOLDOWN_MS = 60_000;
/** Back to the foreground after 15 minutes or more starts a sync (HU-011). */
export const FOREGROUND_AFTER_MS = 15 * 60_000;
/** Each sync asks again for 3 days before the last one, to catch pending movements that got booked. */
export const OVERLAP_MS = 3 * 24 * 60 * 60_000;
/** The first sync brings 12 months (HU-010). */
export const FIRST_SYNC_MONTHS = 12;
/** An access token with less than this left is renewed before the sync (HU-030). */
export const REFRESH_MARGIN_MS = 60_000;

const ms = (iso: IsoDateTime) => Date.parse(iso);

/** False while the link's last start is less than 60 s ago. A clock that went back never locks it. */
export function canStartSync(link: { lastAttemptAt: IsoDateTime | null }, now: Date): boolean {
  if (link.lastAttemptAt === null) return true;
  const elapsed = now.getTime() - ms(link.lastAttemptAt);
  return elapsed < 0 || elapsed >= COOLDOWN_MS;
}

/** True when the app was in the background for 15 minutes or more. */
export function shouldSyncOnForeground(backgroundSince: IsoDateTime | null, now: Date): boolean {
  return backgroundSince !== null && now.getTime() - ms(backgroundSince) >= FOREGROUND_AFTER_MS;
}

/** The `since` of the movements query: 12 months back the first time, else the overlap. */
export function syncSince(lastSyncedAt: IsoDateTime | null, now: Date): IsoDateTime {
  if (lastSyncedAt !== null) return new Date(ms(lastSyncedAt) - OVERLAP_MS).toISOString();
  const since = new Date(now.getTime());
  const day = since.getUTCDate();
  since.setUTCDate(1);
  since.setUTCMonth(since.getUTCMonth() - FIRST_SYNC_MONTHS);
  // 29 February a year back is 28 February, not 1 March.
  const lastDay = new Date(
    Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + 1, 0),
  ).getUTCDate();
  since.setUTCDate(Math.min(day, lastDay));
  return since.toISOString();
}

export function needsRefresh(tokens: { accessExpiresAt: IsoDateTime }, now: Date): boolean {
  return ms(tokens.accessExpiresAt) - now.getTime() < REFRESH_MARGIN_MS;
}
