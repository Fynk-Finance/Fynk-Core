// When the vault locks and when a login counts as fresh (M02, Lock states). Pure: callers pass the time.

/** The vault locks when the app comes back after more than this long in the background. */
export const BACKGROUND_LOCK_MS = 5 * 60 * 1000;
/** A Keycloak login this recent is enough to open the vault without asking for the password again. */
export const FRESH_LOGIN_MS = 5 * 60 * 1000;

/** True when the app was in the background for more than 5 minutes (exactly 5 does not lock). */
export const shouldLock = (backgroundSinceMs: number, nowMs: number): boolean =>
  nowMs - backgroundSinceMs > BACKGROUND_LOCK_MS;

/** True when the last interactive login is at most 5 minutes old. A missing login is never fresh. */
export function isFreshLogin(lastLoginAt: Date | null, now: Date): boolean {
  if (!lastLoginAt) return false;
  // Absolute value: a phone clock a little behind the id token still counts.
  return Math.abs(now.getTime() - lastLoginAt.getTime()) <= FRESH_LOGIN_MS;
}
