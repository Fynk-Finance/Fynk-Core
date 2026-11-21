// PKCE S256, state and nonces for the bank link (HU-030, RFC 7636).
import { base64Url, challengeOf, createPkce, newNonce } from './pkce';

// RFC 7636, Appendix B: these 32 octets give this verifier and this challenge.
const RFC_OCTETS = Uint8Array.from([
  116, 24, 223, 180, 151, 153, 224, 37, 79, 250, 96, 125, 216, 173, 187, 186, 22, 212, 37, 77, 105,
  214, 191, 240, 91, 88, 5, 88, 83, 132, 141, 121,
]);
const RFC_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const RFC_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

const counting = () => {
  let n = 0;
  return (length: number) => Uint8Array.from({ length }, () => n++ % 256);
};

it('encodes base64url without padding', () => {
  expect(base64Url(new Uint8Array([]))).toBe('');
  expect(base64Url(Uint8Array.from([0xfb, 0xff]))).toBe('-_8');
  expect(base64Url(Uint8Array.from([102, 111, 111, 98, 97]))).toBe('Zm9vYmE');
  expect(base64Url(RFC_OCTETS)).toBe(RFC_VERIFIER);
});

it('derives the S256 challenge of RFC 7636', () => {
  expect(challengeOf(RFC_VERIFIER)).toBe(RFC_CHALLENGE);
});

it('creates a 43 character verifier, its challenge and a separate state', () => {
  const random = jest.fn((length: number) =>
    length === 32 ? RFC_OCTETS : new Uint8Array(length).fill(7),
  );
  const pkce = createPkce(random);
  expect(pkce).toEqual({
    verifier: RFC_VERIFIER,
    challenge: RFC_CHALLENGE,
    method: 'S256',
    state: base64Url(new Uint8Array(16).fill(7)),
  });
  expect(random).toHaveBeenCalledWith(32);
  expect(random).toHaveBeenCalledWith(16);
});

it('never reuses randomness between the verifier, the state and the next link', () => {
  const random = counting();
  const first = createPkce(random);
  const second = createPkce(random);
  expect(new Set([first.verifier, first.state, second.verifier, second.state]).size).toBe(4);
  expect(first.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(first.state).toMatch(/^[A-Za-z0-9_-]{22}$/);
});

it('makes nonces the API accepts (16 to 64 characters, URL safe)', () => {
  const random = counting();
  const a = newNonce(random);
  const b = newNonce(random);
  expect(a).toMatch(/^[A-Za-z0-9_-]{32}$/);
  expect(a).not.toBe(b);
});
