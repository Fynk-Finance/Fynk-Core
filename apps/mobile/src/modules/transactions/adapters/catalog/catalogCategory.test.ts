// The catalog step takes only categories the app knows (00-shared-contracts.md, section 2).
import { createCatalogCategory } from './catalogCategory';

describe('createCatalogCategory', () => {
  const catalog: Record<string, string> = {
    netflix: 'subscriptions',
    epm: 'utilities',
    'tienda nueva': 'streaming',
  };
  const lookup = jest.fn((key: string) => catalog[key] ?? null);
  const catalogCategory = createCatalogCategory(() => lookup);

  it('gives the catalog category of a merchant', () => {
    expect(catalogCategory('netflix')).toBe('subscriptions');
    expect(catalogCategory('epm')).toBe('utilities');
    expect(lookup).toHaveBeenCalledWith('netflix');
  });

  it('gives null for an unknown merchant', () => {
    expect(catalogCategory('panaderia la espiga')).toBeNull();
  });

  it('ignores a category the app does not know', () => {
    expect(catalogCategory('tienda nueva')).toBeNull();
  });

  it('gives null when the catalog cannot answer', () => {
    const failing = createCatalogCategory(() => {
      throw new Error('vault locked');
    });
    expect(failing('netflix')).toBeNull();
  });
});
