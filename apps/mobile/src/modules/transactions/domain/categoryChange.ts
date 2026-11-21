// A category the person picked (HU-018 modificación manual e historial de cambios).
import type { CategoryId, Id, IsoDateTime } from '@shared/domain/types';

/** One line of the history: "Cambiaste de Otros a Restaurantes el 21 sep". */
export interface CategoryChange {
  id: Id;
  transactionId: Id;
  from: CategoryId;
  to: CategoryId;
  changedAt: IsoDateTime;
}

/**
 * What a change leaves for the next categorizations and for the backup
 * (transactions.category_overrides): every movement of a merchant, or one bank movement by the
 * bank's id, so a new phone applies it again after its first sync.
 */
export interface CategoryOverride {
  kind: 'merchant' | 'transaction';
  key: string;
  categoryId: CategoryId;
  updatedAt: IsoDateTime;
}

export const OVERRIDES_COLLECTION = 'transactions.category_overrides';

/** Backup record id of an override: "merchant:juan valdez" or "transaction:p-123". */
export function overrideRecordId(o: Pick<CategoryOverride, 'kind' | 'key'>): string {
  return `${o.kind}:${o.key}`;
}

export class InvalidCategoryError extends Error {
  constructor(value: string) {
    super(`Unknown category: ${value}`);
    this.name = 'InvalidCategoryError';
  }
}
