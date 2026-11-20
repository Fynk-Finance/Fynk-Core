// One vault per account on the phone: the slot names its database file and Keychain entries.
// It is derived from the Keycloak `sub`, so the raw id never appears in a file or service name.
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';

/** Lowercase hex of the first 16 bytes of SHA-256(sub): 32 characters. */
export function vaultSlot(userId: string): string {
  return bytesToHex(sha256(utf8ToBytes(userId)).slice(0, 16));
}
