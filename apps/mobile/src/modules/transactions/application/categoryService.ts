// Changing a category (HU-018 modificación manual, historial de cambios, actualiza reportes
// asociados). "Aplicar a todos los movimientos de <comercio>" changes every movement of the
// merchant and leaves an override for the next ones; otherwise a bank movement leaves an
// override by the bank's id, so a new phone applies it again after its first sync. Each real
// change writes a history line, and transactions.changed tells M10 to recount its totals.
import { isCategoryId } from '@shared/domain/categories';
import type { CategoryId, Clock, Id } from '@shared/domain/types';
import type { AppEvents } from '@shared/events/appEvents';
import type { BackupCollection, MarkDirty } from '@shared/ports';

import {
  InvalidCategoryError,
  OVERRIDES_COLLECTION,
  overrideRecordId,
  type CategoryChange,
  type CategoryOverride,
} from '../domain/categoryChange';
import type { CategoryStore, TransactionsStore } from './ports';
import { TransactionNotFoundError } from './transactionsService';

export interface CategoryServiceDeps {
  store: () => TransactionsStore;
  categories: () => CategoryStore;
  events: Pick<AppEvents, 'emit'>;
  clock: Clock;
  newId: () => Id;
  markDirty: MarkDirty;
}

export interface CategoryService {
  /** Gives the ids whose category changed. */
  changeCategory(id: Id, to: CategoryId, opts?: { applyToMerchant?: boolean }): Promise<Id[]>;
  getCategoryHistory(id: Id): Promise<CategoryChange[]>;
  /** transactions.category_overrides, for M2's encrypted backup. */
  backupCollection: BackupCollection<CategoryOverride>;
}

export function createCategoryService(deps: CategoryServiceDeps): CategoryService {
  return {
    async changeCategory(id, to, { applyToMerchant = false } = {}) {
      if (!isCategoryId(to)) throw new InvalidCategoryError(String(to));
      const tx = await deps.store().get(id);
      if (!tx) throw new TransactionNotFoundError();

      const categories = deps.categories();
      let ids = [id];
      let override: Pick<CategoryOverride, 'kind' | 'key'> | null = null;
      if (applyToMerchant && tx.merchantKey) {
        ids = await categories.merchantIds(tx.merchantKey);
        override = { kind: 'merchant', key: tx.merchantKey };
      } else if (tx.source === 'bank' && tx.providerTxId) {
        override = { kind: 'transaction', key: tx.providerTxId };
      }

      const { changed } = await categories.recategorize({
        ids,
        to,
        at: deps.clock.now().toISOString(),
        newId: deps.newId,
        override,
      });
      if (override) deps.markDirty(OVERRIDES_COLLECTION, overrideRecordId(override));
      if (changed.length > 0) deps.events.emit({ type: 'transactions.changed', ids: changed });
      return changed;
    },

    getCategoryHistory(id) {
      return deps.categories().history(id);
    },

    backupCollection: {
      module: 'transactions',
      collection: OVERRIDES_COLLECTION,
      exportAll: () => deps.categories().exportOverrides(),
      importAll: (records) => deps.categories().importOverrides(records),
    },
  };
}
