// In-memory backup registry for tests: same contract as M2's registerBackupCollection and
// markDirty, plus helpers to inspect what a module registered and marked.
// Test-only: never import this file from app code.
import type { Id } from '../domain/types';
import type { BackupCollection, BackupRecord } from '../ports/backup';

export interface InMemoryBackupRegistry {
  registerBackupCollection<T>(c: BackupCollection<T>): void;
  markDirty(collection: string, id: Id): void;
  /** Names of the registered collections, in registration order. */
  collections(): string[];
  /** Ids marked dirty in a collection since the last clearDirty(). */
  dirty(collection: string): Id[];
  clearDirty(): void;
  /** Exports every collection, like M2 does before an upload. */
  exportAll(): Promise<Record<string, BackupRecord<unknown>[]>>;
  /** Imports records into registered collections, like M2 does on restore. */
  importAll(records: Record<string, BackupRecord<unknown>[]>): Promise<void>;
}

export function createInMemoryBackupRegistry(): InMemoryBackupRegistry {
  const registered = new Map<string, BackupCollection<unknown>>();
  const dirty = new Map<string, Set<Id>>();

  const get = (collection: string): BackupCollection<unknown> => {
    const c = registered.get(collection);
    if (!c) throw new Error(`Backup collection "${collection}" is not registered`);
    return c;
  };

  return {
    registerBackupCollection(c) {
      if (!c.collection.startsWith(`${c.module}.`)) {
        throw new Error(`Backup collection "${c.collection}" must start with "${c.module}."`);
      }
      if (c.module === 'bank') {
        throw new Error('Bank movements and bank tokens are never backed up');
      }
      if (registered.has(c.collection)) {
        throw new Error(`Backup collection "${c.collection}" is already registered`);
      }
      registered.set(c.collection, c as BackupCollection<unknown>);
      dirty.set(c.collection, new Set());
    },
    markDirty(collection, id) {
      get(collection);
      dirty.get(collection)?.add(id);
    },
    collections() {
      return [...registered.keys()];
    },
    dirty(collection) {
      get(collection);
      return [...(dirty.get(collection) ?? [])];
    },
    clearDirty() {
      for (const set of dirty.values()) set.clear();
    },
    async exportAll() {
      const out: Record<string, BackupRecord<unknown>[]> = {};
      for (const [name, c] of registered) out[name] = await c.exportAll();
      return out;
    },
    async importAll(records) {
      for (const [name, list] of Object.entries(records)) {
        await get(name).importAll(list);
      }
    },
  };
}
