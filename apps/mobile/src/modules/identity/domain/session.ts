// Session rules of the identity module. Pure: no I/O, no clock of its own.
import type { IsoDateTime } from '@shared/domain/types';

import { fromBase64 } from './device';

/** Tokens Keycloak gives the app. Kept only in Keychain or Keystore (adapters/keychain). */
export interface TokenSet {
  accessToken: string;
  accessTokenExpiresAt: IsoDateTime;
  refreshToken: string;
  idToken: string;
}

/** `restoring` while the stored tokens are read at start. */
export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';

/** The access token is refreshed this long before it expires (M1 prompt: 60 s). */
export const REFRESH_MARGIN_MS = 60_000;

export function isRefreshDue(tokens: TokenSet, now: Date): boolean {
  const expiresAt = Date.parse(tokens.accessTokenExpiresAt);
  if (Number.isNaN(expiresAt)) return true;
  return now.getTime() >= expiresAt - REFRESH_MARGIN_MS;
}

/** Reads a stored token set, or null when it is missing a field or corrupt. */
export function parseTokenSet(raw: string): TokenSet | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const t = value as Record<string, unknown>;
  const fields = ['accessToken', 'accessTokenExpiresAt', 'refreshToken', 'idToken'] as const;
  if (!fields.every((f) => typeof t[f] === 'string' && t[f] !== '')) return null;
  if (Number.isNaN(Date.parse(t.accessTokenExpiresAt as string))) return null;
  return {
    accessToken: t.accessToken as string,
    accessTokenExpiresAt: t.accessTokenExpiresAt as string,
    refreshToken: t.refreshToken as string,
    idToken: t.idToken as string,
  };
}

/** The claims of a JWT payload, or null when the token cannot be read. The signature is not checked. */
function claimsOf(jwt: string): Record<string, unknown> | null {
  const payload = jwt.split('.')[1];
  if (!payload) return null;
  const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = fromBase64(b64.padEnd(Math.ceil(b64.length / 4) * 4, '='));
  if (!bytes) return null;
  // Byte by byte is enough for `sub` and `auth_time`; other claims may decode wrong.
  let text = '';
  for (const b of bytes) text += String.fromCharCode(b);
  try {
    const claims: unknown = JSON.parse(text);
    return typeof claims === 'object' && claims !== null
      ? (claims as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * The account (`sub`) a JWT was issued to, or null when the token cannot be read. It only reads
 * the payload to compare accounts; the signature is checked by the API, not here.
 */
export function subjectOf(jwt: string): string | null {
  const sub = claimsOf(jwt)?.sub;
  return typeof sub === 'string' && sub !== '' ? sub : null;
}

/**
 * When the person last typed their credentials: the `auth_time` of an id token, in seconds since
 * the epoch. Keycloak keeps it across refreshes. Null when missing or not a positive integer.
 */
export function authTimeOf(jwt: string): number | null {
  const authTime = claimsOf(jwt)?.auth_time;
  return typeof authTime === 'number' && Number.isSafeInteger(authTime) && authTime > 0
    ? authTime
    : null;
}
