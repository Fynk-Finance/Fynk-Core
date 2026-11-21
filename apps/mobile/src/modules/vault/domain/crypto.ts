// Vault cryptography as pure functions over @noble. No randomness in here: keys and nonces
// are parameters, so the same input always gives the same output (and tests use fixed vectors).
import { gcm } from '@noble/ciphers/aes.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

export const KEY_LENGTH = 32;
export const NONCE_LENGTH = 12;
const TAG_LENGTH = 16;

const BACKUP_KEY_INFO = 'fynk/backup/v1';
const DEVICE_PROOF_INFO = 'fynk/device-proof/v1';

export class VaultCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultCryptoError';
  }
}

const utf8 = (text: string) => new TextEncoder().encode(text);

function assertLength(name: string, bytes: Uint8Array, length: number): void {
  if (!(bytes instanceof Uint8Array) || bytes.length !== length) {
    throw new VaultCryptoError(`${name} must be ${length} bytes`);
  }
}

/** AES-256-GCM. Returns ciphertext followed by the 16 byte tag. */
export function seal(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array,
): Uint8Array {
  assertLength('key', key, KEY_LENGTH);
  assertLength('nonce', nonce, NONCE_LENGTH);
  return gcm(key, nonce, aad).encrypt(plaintext);
}

/** Reverses seal. Any change to the ciphertext, tag, nonce, key or AAD throws VaultCryptoError. */
export function open(
  key: Uint8Array,
  nonce: Uint8Array,
  sealed: Uint8Array,
  aad: Uint8Array,
): Uint8Array {
  assertLength('key', key, KEY_LENGTH);
  assertLength('nonce', nonce, NONCE_LENGTH);
  if (!(sealed instanceof Uint8Array) || sealed.length < TAG_LENGTH) {
    throw new VaultCryptoError('sealed data is too short');
  }
  try {
    return gcm(key, nonce, aad).decrypt(sealed);
  } catch {
    // The library message says nothing useful, and nothing about the data may reach logs.
    throw new VaultCryptoError('decryption failed');
  }
}

// HKDF-SHA256 with the RFC 5869 default salt (a string of zeros).
function derive(dek: Uint8Array, info: string): Uint8Array {
  assertLength('dek', dek, KEY_LENGTH);
  return hkdf(sha256, dek, undefined, utf8(info), KEY_LENGTH);
}

/** The key that encrypts backup records. Derived from the DEK, never stored. */
export const deriveBackupKey = (dek: Uint8Array): Uint8Array => derive(dek, BACKUP_KEY_INFO);

/**
 * Proof that a device holds the DEK. The server stores only its hash; a new phone sends the
 * proof once to be activated. It is one way: the DEK cannot be derived from it.
 */
export const deriveDeviceProof = (dek: Uint8Array): Uint8Array => derive(dek, DEVICE_PROOF_INFO);

export const deviceProofHash = (proof: Uint8Array): Uint8Array => sha256(proof);

/** AAD of a backup record: binds the ciphertext to its owner, collection, id and version. */
export function recordAad(
  userId: string,
  collection: string,
  recordId: string,
  version: number,
): Uint8Array {
  return utf8(`${userId}|${collection}|${recordId}|${version}`);
}

/** The 6 digit code both phones show when approving a new device (HU-046). */
export function approvalCode(publicKey: Uint8Array): string {
  assertLength('publicKey', publicKey, KEY_LENGTH);
  const [a = 0, b = 0, c = 0, d = 0] = sha256(publicKey);
  const value = ((a << 24) | (b << 16) | (c << 8) | d) >>> 0;
  return String(value % 1_000_000).padStart(6, '0');
}
