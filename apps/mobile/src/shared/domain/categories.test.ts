import { CATEGORY_IDS, categoryLabel, isCategoryId } from './categories';

describe('categories', () => {
  it('has a Spanish label for each of the 20 categories', () => {
    expect(CATEGORY_IDS).toHaveLength(20);
    for (const id of CATEGORY_IDS) {
      expect(categoryLabel(id).length).toBeGreaterThan(0);
    }
  });

  it.each([
    ['salary', 'Salario'],
    ['utilities', 'Servicios públicos'],
    ['telecom', 'Internet y celular'],
    ['treats', 'Antojos'],
    ['card_payment', 'Pago de tarjeta'],
    ['other', 'Otros'],
  ] as const)('labels %s as %s', (id, label) => {
    expect(categoryLabel(id)).toBe(label);
  });

  it('recognizes valid ids only', () => {
    expect(isCategoryId('groceries')).toBe(true);
    expect(isCategoryId('toString')).toBe(false);
    expect(isCategoryId('food')).toBe(false);
  });
});
