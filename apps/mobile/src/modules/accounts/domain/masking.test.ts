import { last4Of, maskedNumber } from './masking';

const digitsIn = (text: string | null) => (text ?? '').replace(/\D/g, '').length;

describe('maskedNumber (solo últimos 4 dígitos)', () => {
  it('shows the last 4 digits after two dots', () => {
    expect(maskedNumber('4821')).toBe('•• 4821');
  });

  it.each(['4532015112830366', '****4821', '4532 0151 1283 0366', '000123456789'])(
    'never shows more than 4 digits of %s',
    (raw) => {
      expect(digitsIn(maskedNumber(raw))).toBe(4);
      expect(maskedNumber(raw)?.endsWith(raw.slice(-4))).toBe(true);
    },
  );

  it('shows short numbers as they are', () => {
    expect(maskedNumber('12')).toBe('•• 12');
  });

  it('returns null when there is no number', () => {
    expect(maskedNumber(null)).toBeNull();
    expect(maskedNumber('')).toBeNull();
    expect(maskedNumber('****')).toBeNull();
  });
});

describe('last4Of', () => {
  it('keeps only the last 4 digits', () => {
    expect(last4Of('****3312')).toBe('3312');
    expect(last4Of('4532015112830366')).toBe('0366');
    expect(last4Of(undefined)).toBeNull();
  });
});
