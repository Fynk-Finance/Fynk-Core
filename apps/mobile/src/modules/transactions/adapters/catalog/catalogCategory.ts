// M9's merchant catalog as the catalog step of the categorization (HU-018). The catalog comes
// from the backend, so a category the app does not know counts as no category.
import { isCategoryId } from '@shared/domain/categories';
import type { CategoryId } from '@shared/domain/types';

/** M9's getCatalogCategory: the catalog's category for a merchant key, or null. */
export type CatalogLookup = (merchantKey: string) => string | null;

/** The lookup as the categorization's catalog step. A failing lookup counts as no category. */
export function createCatalogCategory(
  lookup: () => CatalogLookup,
): (merchantKey: string) => CategoryId | null {
  return (merchantKey) => {
    let category: string | null;
    try {
      category = lookup()(merchantKey);
    } catch {
      return null;
    }
    return category !== null && isCategoryId(category) ? category : null;
  };
}
