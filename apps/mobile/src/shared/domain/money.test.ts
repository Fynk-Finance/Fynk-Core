import { formatCop, formatCopSigned, parseCopInput } from './money';

describe('formatCop', () => {
  it('prints the Dashboard balance with dot thousands and no decimals', () => {
    expect(formatCop(1248035000)).toBe('$12.480.350');
  });

  it.each([
    [0, '$0'],
    [100, '$1'],
    [100000, '$1.000'],
    [11260000, '$112.600'], // Billetera subscriptions total
    [5680000, '$56.800'], // Billetera low use saving
    [193060000, '$1.930.600'], // Billetera fixed expenses
    [840000000, '$8.400.000'], // Onboarding accounts total
    [145390000, '$1.453.900'], // Onboarding recurring total
    [84000000, '$840.000'], // Onboarding goals total
  ])('formats %d as %s', (minor, expected) => {
    expect(formatCop(minor)).toBe(expected);
  });

  it('prints negative amounts with a leading minus', () => {
    expect(formatCop(-18430000)).toBe('-$184.300');
  });

  it('rounds half a peso away from zero', () => {
    expect(formatCop(149)).toBe('$1');
    expect(formatCop(150)).toBe('$2');
    expect(formatCop(-150)).toBe('-$2');
  });

  it('never prints a minus for an amount that rounds to zero', () => {
    expect(formatCop(-40)).toBe('$0');
  });

  it('rejects floats and unsafe integers', () => {
    expect(() => formatCop(12.5)).toThrow(RangeError);
    expect(() => formatCop(Number.NaN)).toThrow(RangeError);
    expect(() => formatCop(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError);
  });
});

describe('formatCopSigned', () => {
  it('prints income with a plus sign', () => {
    expect(formatCopSigned(520000000)).toBe('+$5.200.000');
  });

  it('prints spending with a minus sign', () => {
    expect(formatCopSigned(-18430000)).toBe('-$184.300');
  });

  it('prints zero without a sign', () => {
    expect(formatCopSigned(0)).toBe('$0');
    expect(formatCopSigned(40)).toBe('$0');
  });
});

describe('parseCopInput', () => {
  it.each([
    ['$12.480.350', 1248035000],
    ['12.480.350', 1248035000],
    ['12480350', 1248035000],
    ['$ 5.200.000', 520000000],
    ['  1.000 ', 100000],
    ['0', 0],
    ['1.500,50', 150050],
    ['1.500,5', 150050],
    ['-$184.300', -18430000],
    ['+$5.200.000', 520000000],
  ])('parses %p as %d', (input, expected) => {
    expect(parseCopInput(input)).toBe(expected);
  });

  it.each([
    '',
    '$',
    'abc',
    '12.48',
    '1.0000',
    '1,234.56',
    '12,345',
    '1.500,505',
    '$-5',
    '--5',
    '1e6',
  ])('returns null for %p', (input) => {
    expect(parseCopInput(input)).toBeNull();
  });

  it('round-trips with formatCop', () => {
    expect(parseCopInput(formatCop(1248035000))).toBe(1248035000);
  });

  it('returns null when the amount does not fit a safe integer', () => {
    expect(parseCopInput('999999999999999999')).toBeNull();
  });
});
