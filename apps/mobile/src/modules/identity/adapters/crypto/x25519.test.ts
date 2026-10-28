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

  it('makes 32 byte keys from expo-crypto by default', () => {
    const pair = createKeyPairGenerator().generate();
    expect(fromBase64(pair.privateKey)).toHaveLength(32);
    expect(fromBase64(pair.publicKey)).toHaveLength(32);
  });
});
