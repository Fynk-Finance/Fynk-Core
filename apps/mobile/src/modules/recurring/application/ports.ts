// Ports of the recurring module. The vault adapter implements RecurringStore
// (adapters/vault/vaultRecurringStore.ts).
import type { Id, IsoDateTime } from '@shared/domain/types';

import type { StoredRecurringItem } from '../domain/item';

export interface RecurringStore {
  /** Every item, active and cancelled, oldest first. */
  list(): Promise<StoredRecurringItem[]>;
  get(id: Id): Promise<StoredRecurringItem | null>;
  /** Inserts, or replaces the editable fields of an item with the same id. */
  save(item: StoredRecurringItem): Promise<void>;
  /** Deletes the item (a tombstone, so the backup carries the deletion). */
  remove(id: Id, at: IsoDateTime): Promise<void>;
  /** "Ya la cancelé": the item stays as a record with status cancelled and the time. */
  markCancelled(id: Id, at: IsoDateTime): Promise<void>;
}
