import { fromBase64, toBase64 } from '../../domain/device';
import { createKeyPairGenerator } from './x25519';

const hex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));

jest.mock('expo-crypto', () => ({
  getRandomBytes: jest.fn((n: number) => new Uint8Array(n).fill(1)),
  randomUUID: jest.fn(() => '00000000-0000-4000-8000-000000000000'),
}));

describe('createKeyPairGenerator', () => {
  it('matches the RFC 7748 test vector (Alice)', () => {
    const priv = hex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
    const pair = createKeyPairGenerator(() => priv).generate();
    expect(pair.privateKey).toBe(toBase64(priv));
    expect(fromBase64(pair.publicKey)).toEqual(
      hex('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a'),
    );
  });

  it('agrees on the RFC 7748 shared secret from both sides', () => {
    const alice = hex('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a');
    const bob = hex('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb');
    const keys = createKeyPairGenerator();
    const expected = hex('4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742');
    const bobPublic = hex('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');
    const alicePublic = hex('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a');
    expect(keys.sharedSecret(toBase64(alice), bobPublic)).toEqual(expected);
    expect(keys.sharedSecret(toBase64(bob), alicePublic)).toEqual(expected);
  });

  it('rejects a private key that is not base64', () => {
    expect(() => createKeyPairGenerator().sharedSecret('%%%', new Uint8Array(32))).toThrow();
  });

  it('makes 32 byte keys from expo-crypto by default', () => {
    const pair = createKeyPairGenerator().generate();
    expect(fromBase64(pair.privateKey)).toHaveLength(32);
    expect(fromBase64(pair.publicKey)).toHaveLength(32);
  });
});
