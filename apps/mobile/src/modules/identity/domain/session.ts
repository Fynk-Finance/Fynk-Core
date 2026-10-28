// Session rules of the identity module. Pure: no I/O, no clock of its own.
import type { IsoDateTime } from '@shared/domain/types';

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
