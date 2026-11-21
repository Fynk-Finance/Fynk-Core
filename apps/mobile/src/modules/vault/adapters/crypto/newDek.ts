// The only place the vault asks for randomness: a new DEK, from the OS random source.
import { getRandomBytes } from 'expo-crypto';

import { KEY_LENGTH } from '../../domain/crypto';

/** `randomBytes` is injectable for tests. */
export function newDek(randomBytes: (length: number) => Uint8Array = getRandomBytes): Uint8Array {
  const dek = randomBytes(KEY_LENGTH);
  if (dek.length !== KEY_LENGTH) throw new Error('random source returned the wrong length');
  return dek;
}
