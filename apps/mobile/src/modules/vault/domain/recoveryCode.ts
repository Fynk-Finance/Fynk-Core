// Recovery code: 128 random bits as 26 Crockford base32 characters (HU-045).
// 26 * 5 = 130 bits, so the stream is padded with 2 zero bits at the end.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const BYTES = 16;
const LENGTH = 26;
const GROUPS = [5, 5, 5, 5, 6];

export function encodeRecoveryCode(bytes: Uint8Array): string {
  if (bytes.length !== BYTES) throw new RangeError(`A recovery code needs ${BYTES} bytes`);
  let buffer = 0;
  let bits = 0;
  let out = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  // 3 bits are left: shift them up so the last 2 bits are the zero padding.
  return out + ALPHABET[(buffer << 2) & 31];
}

/** `XXXXX XXXXX XXXXX XXXXX XXXXXX` */
export function formatRecoveryCode(code: string): string {
  let start = 0;
  return GROUPS.map((size) => {
    const group = code.slice(start, start + size);
    start += size;
    return group;
  }).join(' ');
}

// What a person types is forgiven: spaces and dashes, lowercase, and the look-alikes I, L and O.
const normalize = (input: string) =>
  input
    .replace(/[\s-]+/g, '')
    .toUpperCase()
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');

/** True when what the person typed is the given group of the code, ignoring the same slips. */
export const matchesRecoveryGroup = (typed: string, group: string): boolean =>
  group !== '' && normalize(typed) === normalize(group);

/** The canonical 26 character code, or null when the input is not a valid code. */
export function parseRecoveryCode(input: string): string | null {
  const code = normalize(input);
  if (code.length !== LENGTH) return null;
  for (const char of code) if (!ALPHABET.includes(char)) return null;
  // The last character carries 3 data bits and 2 padding bits, which must be zero.
  if ((ALPHABET.indexOf(code[LENGTH - 1] ?? '') & 3) !== 0) return null;
  return code;
}

/** Back to the 16 bytes. Throws when the code is not canonical (use parseRecoveryCode first). */
export function decodeRecoveryCode(code: string): Uint8Array {
  if (parseRecoveryCode(code) !== code) throw new RangeError('Not a canonical recovery code');
  const out = new Uint8Array(BYTES);
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of code) {
    buffer = (buffer << 5) | ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8 && index < BYTES) {
      out[index++] = (buffer >>> (bits - 8)) & 255;
      bits -= 8;
    }
    buffer &= (1 << bits) - 1;
  }
  return out;
}
