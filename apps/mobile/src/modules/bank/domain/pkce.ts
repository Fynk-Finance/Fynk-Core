// PKCE S256 (RFC 7636), the OAuth state and the request nonces of the bank link (HU-030).
// Pure: the random bytes are injected, so the same input gives the same output.
import { sha256 } from '@noble/hashes/sha2.js';

export type RandomBytes = (length: number) => Uint8Array;

export interface Pkce {
  /** Kept on the phone until the exchange; never logged. */
  verifier: string;
  challenge: string;
  method: 'S256';
  /** Checked on the callback: a different one means the return is not ours. */
  state: string;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** Base64url without padding (RFC 4648, section 5). */
export function base64Url(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]!;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += ALPHABET[b0 >> 2]!;
    out += ALPHABET[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]!;
    if (b1 !== undefined) out += ALPHABET[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]!;
    if (b2 !== undefined) out += ALPHABET[b2 & 63]!;
  }
  return out;
}

/** BASE64URL(SHA256(ASCII(verifier))). The verifier is base64url, so ASCII is its char codes. */
export function challengeOf(verifier: string): string {
  return base64Url(sha256(Uint8Array.from(verifier, (c) => c.charCodeAt(0))));
}

/** 32 random octets give the 43 character verifier of RFC 7636; 16 give the state. */
export function createPkce(random: RandomBytes): Pkce {
  const verifier = base64Url(random(32));
  return {
    verifier,
    challenge: challengeOf(verifier),
    method: 'S256',
    state: base64Url(random(16)),
  };
}

/** A 32 character X-Request-Nonce (the API takes 16 to 64, and refuses one seen in 5 minutes). */
export function newNonce(random: RandomBytes): string {
  return base64Url(random(24));
}
