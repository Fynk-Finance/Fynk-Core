import { normalizeMerchant } from './normalizeMerchant';

describe('normalizeMerchant', () => {
  it.each([
    ['NETFLIX.COM BOGOTA 1234', 'netflix com'],
    ['Éxito Medellín *4821', 'exito'],
    ['RAPPI*RESTAURANTE 2938 BOGOTÁ D.C.', 'rappi restaurante'],
    ['COMPRA TARJ DEBITO SUPERMERCADO', 'compra supermercado'],
    ['GIMNASIO DEMO', 'gimnasio demo'],
    ['TRANSPORTE URBANO DEMO', 'transporte urbano demo'],
    ['NOMINA EMPRESA DEMO SAS', 'nomina empresa demo sas'],
    ['  Panadería   La   Ñapa  ', 'panaderia la napa'],
    ['TIENDA SANTA MARTA POS VISA', 'tienda'],
    ['Cafe Cali Colombia', 'cafe'],
  ])('normalizes %p to %p', (raw, expected) => {
    expect(normalizeMerchant(raw)).toBe(expected);
  });

  it('keeps words that only contain a city or card word', () => {
    expect(normalizeMerchant('Calibre Store')).toBe('calibre store');
    expect(normalizeMerchant('Postobon')).toBe('postobon');
  });

  it('gives the same key for the same merchant written differently', () => {
    expect(normalizeMerchant('Streaming de Video 3321 BOGOTA')).toBe(
      normalizeMerchant('STREAMING DE VIDEO *9921'),
    );
  });

  it('returns an empty string when nothing is left', () => {
    expect(normalizeMerchant('')).toBe('');
    expect(normalizeMerchant('1234 *5678')).toBe('');
    expect(normalizeMerchant('BOGOTA')).toBe('');
  });

  it('is idempotent', () => {
    const once = normalizeMerchant('RAPPI*RESTAURANTE 2938 BOGOTÁ D.C.');
    expect(normalizeMerchant(once)).toBe(once);
  });
});
