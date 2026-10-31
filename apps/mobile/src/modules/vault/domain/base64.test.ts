import { fromBase64, toBase64 } from './base64';

it('matches the RFC 4648 vectors, with padding', () => {
  const bytes = (s: string) => new TextEncoder().encode(s);
  expect(toBase64(bytes(''))).toBe('');
  expect(toBase64(bytes('f'))).toBe('Zg==');
  expect(toBase64(bytes('fo'))).toBe('Zm8=');
  expect(toBase64(bytes('foo'))).toBe('Zm9v');
  expect(toBase64(bytes('foobar'))).toBe('Zm9vYmFy');
});

it('round-trips every byte value', () => {
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  expect(fromBase64(toBase64(all))).toEqual(all);
});

it('rejects text that is not padded standard base64', () => {
  expect(fromBase64('Zg')).toBeNull();
  expect(fromBase64('Zg=a')).toBeNull();
  expect(fromBase64('Zm9v-w==')).toBeNull();
});
