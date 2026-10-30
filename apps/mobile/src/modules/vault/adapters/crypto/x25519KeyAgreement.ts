// KeyAgreementPort with @noble/curves and the OS random source.
import { x25519 } from '@noble/curves/ed25519.js';
import { getRandomBytes } from 'expo-crypto';

import type { KeyAgreementPort } from '../../application/approveDevice';

/** `randomBytes` is injectable for tests. */
export function createKeyAgreement(
  randomBytes: (length: number) => Uint8Array = getRandomBytes,
): KeyAgreementPort {
  return {
    generate() {
      const privateKey = randomBytes(32);
      return { privateKey, publicKey: x25519.getPublicKey(privateKey) };
    },
    sharedSecret: (privateKey, peerPublicKey) => x25519.getSharedSecret(privateKey, peerPublicKey),
  };
}
