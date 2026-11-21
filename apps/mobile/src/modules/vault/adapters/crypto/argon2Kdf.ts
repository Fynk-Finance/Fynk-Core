// Argon2id for the recovery key, through the native library react-native-argon2.
// The parameters come from the domain and must not change: a stored key is derived with them.
import { KEY_LENGTH } from '../../domain/crypto';
import { RECOVERY_KDF } from '../../domain/recoveryKey';
import type { RecoveryKdf } from '../../application/ports';

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

function fromHex(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  return Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
    parseInt(hex.slice(i * 2, i * 2 + 2), 16),
  );
}

/**
 * `code` is the canonical 26 character recovery code. Resolves to the 32 byte key.
 * The library reads its native module while it loads, so it loads on first use: every module
 * that imports the vault would otherwise need the native module in its tests.
 */
export const argon2Kdf: RecoveryKdf = async (code, salt) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- loaded on first use, see above
  const Argon2 = (require('react-native-argon2') as typeof import('react-native-argon2')).default;
  const { rawHash } = await Argon2(code, toHex(salt), {
    mode: 'argon2id',
    memory: RECOVERY_KDF.memoryKiB,
    iterations: RECOVERY_KDF.iterations,
    parallelism: RECOVERY_KDF.parallelism,
    hashLength: KEY_LENGTH,
    saltEncoding: 'hex',
  });
  const key = fromHex(rawHash);
  // Nothing about the hash goes into the message.
  if (!key || key.length !== KEY_LENGTH) throw new Error('argon2 returned an unexpected hash');
  return key;
};
