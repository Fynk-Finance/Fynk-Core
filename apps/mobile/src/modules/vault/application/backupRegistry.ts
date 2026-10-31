// The backup registry: which collections take part in the backup and which of their records
// changed since the last upload. Same rules as createInMemoryBackupRegistry in @shared/testing.
import type { Id } from '@shared/domain/types';
import type { AppEvents } from '@shared/events/appEvents';
import type { BackupCollection, MarkDirty, RegisterBackupCollection } from '@shared/ports/backup';
import type { GetVaultDb } from '@shared/ports/vault';

export interface DirtyRow {
  collection: string;
  recordId: Id;
  seq: number;
}

export interface BackupRegistry {
  registerBackupCollection: RegisterBackupCollection;
  /** Synchronous, as the port requires. The row is written in the background. */
  markDirty: MarkDirty;
  /** The registered collection, or undefined. */
  collection(name: string): BackupCollection<unknown> | undefined;
  collections(): string[];
  /** True while the vault is unlocked. */
  isOpen(): boolean;
  /** Calls `listener` after every markDirty. Returns the unsubscribe. */
  onMarked(listener: () => void): () => void;
  /** Resolves when every markDirty made so far has reached the table. */
  settled(): Promise<void>;
  readDirty(): Promise<DirtyRow[]>;
  /** Deletes these rows unless they were marked again after `maxSeq`. */
  clearDirty(rows: DirtyRow[], maxSeq: number): Promise<void>;
  /** Forgets the marks kept in memory while the vault was locked (wipe). */
  reset(): void;
}

export interface BackupRegistryDeps {
  getVaultDb: GetVaultDb;
  events: AppEvents;
}

// A new seq is one more than the highest in the table. The vault runs statements one at a time,
// so two marks never read the same maximum.
const UPSERT = `INSERT INTO vault_backup_dirty (collection, record_id, seq)
  VALUES (?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM vault_backup_dirty))
  ON CONFLICT (collection, record_id) DO UPDATE SET seq = excluded.seq`;

export function createBackupRegistry({ getVaultDb, events }: BackupRegistryDeps): BackupRegistry {
  const registered = new Map<string, BackupCollection<unknown>>();
  // Marks made while the vault was locked (or whose write failed), flushed on unlock.
  const memory = new Map<string, Set<Id>>();
  const listeners = new Set<() => void>();
  let writes: Promise<void> = Promise.resolve();
  // Bumped by reset, so a write that fails afterwards does not bring its mark back.
  let epoch = 0;

  const isOpen = (): boolean => {
    try {
      getVaultDb();
      return true;
    } catch {
      return false;
    }
  };

  const keep = (collection: string, id: Id) => {
    let ids = memory.get(collection);
    if (!ids) memory.set(collection, (ids = new Set()));
    ids.add(id);
  };

  async function persist(collection: string, id: Id): Promise<void> {
    const mine = epoch;
    try {
      await getVaultDb().execute(UPSERT, [collection, id]);
    } catch {
      // Locked meanwhile, or the table is not ready: the next unlock writes it.
      if (mine === epoch) keep(collection, id);
    }
  }

  const enqueue = (work: () => Promise<void>) => {
    writes = writes.then(work);
  };

  events.on('vault.unlocked', () => {
    const pending = [...memory].flatMap(([collection, ids]) =>
      [...ids].map((id) => [collection, id] as const),
    );
    memory.clear();
    for (const [collection, id] of pending) enqueue(() => persist(collection, id));
  });

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
    },
    markDirty(collection, id) {
      if (!registered.has(collection)) {
        throw new Error(`Backup collection "${collection}" is not registered`);
      }
      if (isOpen()) enqueue(() => persist(collection, id));
      else keep(collection, id);
      for (const listener of [...listeners]) listener();
    },
    collection: (name) => registered.get(name),
    collections: () => [...registered.keys()],
    isOpen,
    onMarked(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    settled: () => writes,
    async readDirty() {
      const rows = await getVaultDb().query<{ collection: string; record_id: string; seq: number }>(
        'SELECT collection, record_id, seq FROM vault_backup_dirty ORDER BY seq',
      );
      return rows.map((r) => ({
        collection: r.collection,
        recordId: r.record_id,
        seq: Number(r.seq),
      }));
    },
    async clearDirty(rows, maxSeq) {
      if (rows.length === 0) return;
      await getVaultDb().transaction(async (tx) => {
        for (const row of rows) {
          await tx.execute(
            'DELETE FROM vault_backup_dirty WHERE collection = ? AND record_id = ? AND seq <= ?',
            [row.collection, row.recordId, maxSeq],
          );
        }
      });
    },
    reset() {
      epoch += 1;
      memory.clear();
    },
  };
}
