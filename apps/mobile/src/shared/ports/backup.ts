// Backup port (00-shared-contracts.md, section 3.2). Implemented by M2.
// Tests use createInMemoryBackupRegistry() from @shared/testing.
//
// Collections that must register: accounts.cash (M6), transactions.manual and
// transactions.category_overrides (M7), savings.goals and savings.contributions (M8),
// recurring.items and recurring.usage_marks (M9), analytics.caps (M10),
// notifications.settings (M12). Bank movements and bank tokens are never registered.
import type { Id, ModuleName } from '../domain/types';

export interface BackupRecord<T> {
  id: Id;
  version: number;
  deleted: boolean;
  data: T;
}

export interface BackupCollection<T> {
  module: ModuleName;
  collection: string; // 'savings.goals'
  exportAll(): Promise<BackupRecord<T>[]>;
  importAll(records: BackupRecord<T>[]): Promise<void>;
}

/** Signature of M2's registerBackupCollection, exported from @modules/vault. */
export type RegisterBackupCollection = <T>(c: BackupCollection<T>) => void;

/** Signature of M2's markDirty, exported from @modules/vault. Call it after every local write. */
export type MarkDirty = (collection: string, id: Id) => void;
