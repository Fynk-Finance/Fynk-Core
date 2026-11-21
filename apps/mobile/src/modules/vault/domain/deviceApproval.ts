// The crypto of a device approval (HU-046, ADR 0002). The old phone seals the DEK for the new
// phone; the server only carries the result. Pure: the shared secret and the nonce are parameters.
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { KEY_LENGTH, VaultCryptoError, open, seal } from './crypto';

export const APPROVAL_INFO = 'fynk/device-approval/v1';

const utf8 = (text: string) => new TextEncoder().encode(text);

/** HKDF-SHA256 of the X25519 shared secret, with the RFC 5869 default salt. */
export function approvalKey(shared: Uint8Array): Uint8Array {
  if (!(shared instanceof Uint8Array) || shared.length !== KEY_LENGTH) {
    throw new VaultCryptoError(`shared must be ${KEY_LENGTH} bytes`);
  }
  return hkdf(sha256, shared, undefined, utf8(APPROVAL_INFO), KEY_LENGTH);
}

export interface SealGrantInput {
  /** X25519 shared secret between the ephemeral key and the new phone's key. */
  shared: Uint8Array;
  nonce: Uint8Array;
  dek: Uint8Array;
  /** The approval id as UUID text. It is the AAD (lowercase), so a grant works for one request only. */
  approvalId: string;
}

/** Returns the wrapped DEK: AES-256-GCM ciphertext followed by the tag (48 bytes for a 32 byte DEK). */
export function sealGrant({ shared, nonce, dek, approvalId }: SealGrantInput): Uint8Array {
  if (!(dek instanceof Uint8Array) || dek.length !== KEY_LENGTH) {
    throw new VaultCryptoError(`dek must be ${KEY_LENGTH} bytes`);
  }
  const key = approvalKey(shared);
  try {
    return seal(key, nonce, dek, utf8(approvalId.toLowerCase()));
  } finally {
    key.fill(0);
  }
}

export interface OpenGrantInput {
  shared: Uint8Array;
  nonce: Uint8Array;
  wrappedDek: Uint8Array;
  approvalId: string;
}

/** The DEK, or VaultCryptoError when the key, nonce, id or any byte is wrong. */
export function openGrant({ shared, nonce, wrappedDek, approvalId }: OpenGrantInput): Uint8Array {
  const key = approvalKey(shared);
  try {
    const dek = open(key, nonce, wrappedDek, utf8(approvalId.toLowerCase()));
    if (dek.length !== KEY_LENGTH) throw new VaultCryptoError('the grant is not a DEK');
    return dek;
  } finally {
    key.fill(0);
  }
}
