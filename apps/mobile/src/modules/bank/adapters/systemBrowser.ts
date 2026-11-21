// The bank's portal in the system browser (CLAUDE.md, Security rules: never a webview, never a
// bank password inside Fynk). iOS uses ASWebAuthenticationSession, Android a Custom Tab.
import { getRandomBytes } from 'expo-crypto';
import { openAuthSessionAsync } from 'expo-web-browser';

import type { AuthBrowser } from '../application/linkBank';
import type { RandomBytes } from '../domain/pkce';

export const systemBrowser: AuthBrowser = async (url, redirectUrl) => {
  // Ephemeral: the bank's session cookies are not kept in the browser after the link (iOS).
  const result = await openAuthSessionAsync(url, redirectUrl, { preferEphemeralSession: true });
  if (result.type === 'success') return { type: 'success', url: result.url };
  // cancel, dismiss, or locked (another auth session is open): the person did not finish.
  return { type: result.type === 'dismiss' ? 'dismiss' : 'cancel' };
};

/** Cryptographically secure random bytes for PKCE, the state and the nonces. */
export const secureRandom: RandomBytes = (length) => getRandomBytes(length);
