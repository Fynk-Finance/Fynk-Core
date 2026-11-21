import { toFtsQuery } from './searchQuery';

describe('toFtsQuery', () => {
  it('makes every word a quoted prefix', () => {
    expect(toFtsQuery('super')).toBe('"super"*');
    expect(toFtsQuery('  Tienda   de barrio ')).toBe('"Tienda"* "de"* "barrio"*');
  });

  it('keeps accents and letters for the tokenizer to fold', () => {
    expect(toFtsQuery('supermércado')).toBe('"supermércado"*');
    expect(toFtsQuery('Ñandú')).toBe('"Ñandú"*');
  });

  it('turns FTS5 syntax into plain words', () => {
    expect(toFtsQuery('netflix AND "spotify" OR (d1*)')).toBe(
      '"netflix"* "AND"* "spotify"* "OR"* "d1"*',
    );
    expect(toFtsQuery('NEAR(a b)')).toBe('"NEAR"* "a"* "b"*');
  });

  it('gives null when there is nothing to look for', () => {
    expect(toFtsQuery('')).toBeNull();
    expect(toFtsQuery(' *** " ')).toBeNull();
  });

  it('uses at most 8 words', () => {
    expect(toFtsQuery('a b c d e f g h i j')?.split(' ')).toHaveLength(8);
  });
});
