import {
  decodeRecoveryCode,
  encodeRecoveryCode,
  formatRecoveryCode,
  matchesRecoveryGroup,
  parseRecoveryCode,
} from './recoveryCode';

const ZEROS = new Uint8Array(16);
const ONES = new Uint8Array(16).fill(255);
const PATTERN = Uint8Array.from({ length: 16 }, (_, i) => i);

describe('encodeRecoveryCode', () => {
  it('encodes all zero bytes as 26 zeros', () => {
    expect(encodeRecoveryCode(ZEROS)).toBe('0'.repeat(26));
  });

  it('encodes all 0xFF bytes with the 2 padding bits at zero', () => {
    // 128 one bits = 25 full groups (Z) and 3 one bits + 2 zero bits = 11100 = 28 = 'W'.
    expect(encodeRecoveryCode(ONES)).toBe('Z'.repeat(25) + 'W');
  });

  it('encodes bytes 00 01 02 ... 0F', () => {
    // Bits: 00000000 00000001 00000010 00000011 ... regrouped by hand in 5 bit groups.
    expect(encodeRecoveryCode(PATTERN)).toBe('000G40R40M30E209185GR38E1W');
  });

  it('rejects a wrong length', () => {
    expect(() => encodeRecoveryCode(new Uint8Array(15))).toThrow(RangeError);
  });
});

describe('formatRecoveryCode', () => {
  it('groups 5, 5, 5, 5 and 6 characters', () => {
    expect(
      formatRecoveryCode(
        'A'.repeat(5) + 'B'.repeat(5) + 'C'.repeat(5) + 'D'.repeat(5) + 'E'.repeat(6),
      ),
    ).toBe('AAAAA BBBBB CCCCC DDDDD EEEEEE');
  });
});

describe('round trip', () => {
  it.each([
    ['zeros', ZEROS],
    ['ones', ONES],
    ['pattern', PATTERN],
  ])('decodes what it encoded (%s)', (_name, bytes) => {
    const code = encodeRecoveryCode(bytes);
    expect(code).toHaveLength(26);
    expect(parseRecoveryCode(code)).toBe(code);
    expect(decodeRecoveryCode(code)).toEqual(bytes);
  });
});

describe('parseRecoveryCode', () => {
  const code = encodeRecoveryCode(PATTERN);

  it('accepts the formatted code, lowercase, hyphens and extra spaces', () => {
    expect(parseRecoveryCode(formatRecoveryCode(code))).toBe(code);
    expect(parseRecoveryCode(formatRecoveryCode(code).toLowerCase())).toBe(code);
    expect(parseRecoveryCode(formatRecoveryCode(code).replace(/ /g, '-'))).toBe(code);
    expect(parseRecoveryCode(`  ${code.slice(0, 13)} \n ${code.slice(13)}  `)).toBe(code);
  });

  it('maps I and L to 1 and O to 0', () => {
    const typed = code.replace(/1/g, 'l').replace(/0/g, 'o');
    expect(typed).not.toBe(code);
    expect(parseRecoveryCode(typed)).toBe(code);
    expect(parseRecoveryCode(code.replace(/1/g, 'I'))).toBe(code);
  });

  it('rejects U and other characters outside the alphabet', () => {
    expect(parseRecoveryCode('U' + code.slice(1))).toBeNull();
    expect(parseRecoveryCode('!' + code.slice(1))).toBeNull();
    expect(parseRecoveryCode('Ñ' + code.slice(1))).toBeNull();
  });

  it('rejects a wrong length', () => {
    expect(parseRecoveryCode(code.slice(1))).toBeNull();
    expect(parseRecoveryCode(code + '0')).toBeNull();
    expect(parseRecoveryCode('')).toBeNull();
  });

  it('rejects non-zero padding bits', () => {
    // The last character of an all-zero code may only be 0, 8, G or R (low 2 bits zero): '1' is not.
    expect(parseRecoveryCode('0'.repeat(25) + '1')).toBeNull();
    expect(parseRecoveryCode('0'.repeat(25) + '3')).toBeNull();
    expect(parseRecoveryCode('0'.repeat(25) + '4')).toBe('0'.repeat(25) + '4');
  });
});

describe('decodeRecoveryCode', () => {
  it('refuses a code that is not canonical', () => {
    expect(() => decodeRecoveryCode('abc')).toThrow(RangeError);
    expect(() => decodeRecoveryCode('0'.repeat(25) + '1')).toThrow(RangeError);
  });
});

describe('matchesRecoveryGroup', () => {
  it('forgives case, spaces, dashes and the look-alikes I, L and O', () => {
    expect(matchesRecoveryGroup('ab12cd', 'AB12CD')).toBe(true);
    expect(matchesRecoveryGroup(' AB1 2CD ', 'AB12CD')).toBe(true);
    expect(matchesRecoveryGroup('AB-12-CD', 'AB12CD')).toBe(true);
    expect(matchesRecoveryGroup('ABl2CD', 'AB12CD')).toBe(true);
    expect(matchesRecoveryGroup('ABi2CD', 'AB12CD')).toBe(true);
    expect(matchesRecoveryGroup('OB12CD', '0B12CD')).toBe(true);
  });

  it('rejects another group, a partial group and an empty one', () => {
    expect(matchesRecoveryGroup('AB12CE', 'AB12CD')).toBe(false);
    expect(matchesRecoveryGroup('AB12C', 'AB12CD')).toBe(false);
    expect(matchesRecoveryGroup('', '')).toBe(false);
    expect(matchesRecoveryGroup('', 'AB12CD')).toBe(false);
  });
});
