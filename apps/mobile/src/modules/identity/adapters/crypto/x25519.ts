// KeyPairPort and RandomPort with expo-crypto and @noble/curves.
import { x25519 } from '@noble/curves/ed25519.js';
import { getRandomBytes, randomUUID } from 'expo-crypto';

import type { KeyPairPort, RandomPort } from '../../application/ports';
import { fromBase64, toBase64 } from '../../domain/device';

/** `randomBytes` is injectable for tests. */
export function createKeyPairGenerator(
  randomBytes: (length: number) => Uint8Array = getRandomBytes,
): KeyPairPort {
  return {
    generate() {
      const privateKey = randomBytes(32);
      const publicKey = x25519.getPublicKey(privateKey);
      return { privateKey: toBase64(privateKey), publicKey: toBase64(publicKey) };
    },
    sharedSecret(privateKey, peerPublicKey) {
      const key = fromBase64(privateKey);
      if (!key) throw new Error('invalid device key');
      return x25519.getSharedSecret(key, peerPublicKey);
    },
  };
}

export const expoRandom: RandomPort = { newIdempotencyKey: () => randomUUID() };
